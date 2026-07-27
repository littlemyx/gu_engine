import { GU_PROJECT_EXTENSION } from './projectFileFormat';

/**
 * «Сохранить» без «как» требует помнить файл, в который сохраняли. В браузере
 * это умеет только File System Access API (Chrome/Edge): handle живёт в
 * памяти вкладки и разрешает перезапись без диалога. Где API нет — «Сохранить»
 * честно вырождается в скачивание, и об этом говорится в уведомлении.
 *
 * Handle намеренно не персистится: он не сериализуем в localStorage, а
 * IndexedDB ради одной ссылки — лишняя машинерия. Цена — после перезагрузки
 * первое «Сохранить» снова спросит файл.
 */

type PickerAccept = { description?: string; accept: Record<string, string[]> };

type SaveFilePickerOptions = { suggestedName?: string; types?: PickerAccept[] };
type OpenFilePickerOptions = { types?: PickerAccept[]; multiple?: boolean };

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
}

// MIME намеренно octet-stream, а не application/zip: на macOS системный диалог
// сопоставляет application/zip с UTI public.zip-archive, под который неизвестное
// расширение .guproj не подходит — и файл в пикере становится серым. octet-stream
// соответствует базовому public.data, ему конформен любой файл.
const PICKER_TYPES: PickerAccept[] = [
  { description: 'Проект GU Engine', accept: { 'application/octet-stream': [GU_PROJECT_EXTENSION] } },
];

export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled';

export const supportsFsAccess = (): boolean => typeof window.showSaveFilePicker === 'function';

let currentHandle: FileSystemFileHandle | null = null;

export const getCurrentHandle = (): FileSystemFileHandle | null => currentHandle;
export const setCurrentHandle = (handle: FileSystemFileHandle | null): void => {
  currentHandle = handle;
};
export const clearCurrentHandle = (): void => setCurrentHandle(null);
/** Имя файла, в который пишет «Сохранить» — для уведомлений. */
export const getCurrentFileName = (): string | null => currentHandle?.name ?? null;

const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function writeToHandle(handle: FileSystemFileHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** Всегда спрашивает файл. Запоминает выбранный для последующих «Сохранить». */
export async function saveBlobAs(blob: Blob, suggestedName: string): Promise<SaveOutcome> {
  const picker = window.showSaveFilePicker;
  if (!picker) {
    downloadBlob(suggestedName, blob);
    return 'downloaded';
  }
  let handle: FileSystemFileHandle;
  try {
    handle = await picker({ suggestedName, types: PICKER_TYPES });
  } catch (e) {
    if (isAbort(e)) return 'cancelled';
    throw e;
  }
  await writeToHandle(handle, blob);
  setCurrentHandle(handle);
  return 'saved';
}

/**
 * Перезапись запомненного файла. Разрешение могли отозвать (перезагрузка
 * вкладки, отзыв доступа) — тогда молча спрашиваем файл заново, а не роняем
 * сохранение.
 */
export async function saveBlobToCurrent(blob: Blob, suggestedName: string): Promise<SaveOutcome> {
  const handle = currentHandle;
  if (!handle) return saveBlobAs(blob, suggestedName);
  try {
    await writeToHandle(handle, blob);
    return 'saved';
  } catch (e) {
    if (isAbort(e)) return 'cancelled';
    clearCurrentHandle();
    return saveBlobAs(blob, suggestedName);
  }
}

/**
 * Выбор файла проекта. Пикер обязан вызываться прямо из клика: Chrome даёт
 * на это узкое окно пользовательской активации, и любой await до вызова его
 * закрывает — поэтому разбор архива идёт уже после.
 */
export async function pickProjectFile(): Promise<{ file: File; handle: FileSystemFileHandle | null } | 'cancelled'> {
  const picker = window.showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker({ types: PICKER_TYPES, multiple: false });
      if (!handle) return 'cancelled';
      return { file: await handle.getFile(), handle };
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
      throw e;
    }
  }

  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${GU_PROJECT_EXTENSION},application/zip`;
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ? { file, handle: null } : 'cancelled');
    };
    // Отмена в системном диалоге не даёт события — окно снова получает фокус.
    window.addEventListener('focus', () => setTimeout(() => resolve('cancelled'), 500), { once: true });
    input.click();
  });
}
