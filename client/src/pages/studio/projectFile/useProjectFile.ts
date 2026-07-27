import { useCallback, useRef, useState } from 'react';

import { appendRunLog } from '@/narrative/runLog';
import { upsertProject } from '@/project/projectRegistry';
import { projectId } from '@/project/projectScope';
import { pluralize } from '@/ui/plural';

import { useStudioStore } from '../studioStore';

import { getCurrentFileName, pickProjectFile, saveBlobAs, saveBlobToCurrent } from './fileHandle';
import { parseProjectFile } from './parseProject';
import { serializeProject } from './serializeProject';

import type { SaveOutcome } from './fileHandle';
import type { SerializedProject } from './serializeProject';

/**
 * Меню «Файл» со стороны шелла: сохранение, сохранение как и открытие.
 * Уведомления идут двумя каналами — однострочный notice в статус-баре для
 * последнего поступка и лог прогона для подробностей вроде списка ассетов,
 * которые не удалось забрать с сервера.
 */

export type ProjectFileApi = {
  /** Идёт файловая операция: пункты меню на это время выключены. */
  busy: boolean;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  /** Показывает пикер, разбирает архив и открывает подтверждение. */
  pickAndStageOpen: () => Promise<void>;
};

function describeMissing(result: SerializedProject): string | null {
  const missing = result.missingImages.length + result.missingAudio.length;
  if (missing === 0) return null;
  return `${missing} ${pluralize(missing, 'ассет', 'ассета', 'ассетов')} не забрано — сервер ассетов недоступен?`;
}

export function useProjectFile(notify: (message: string | null) => void): ProjectFileApi {
  const [busy, setBusy] = useState(false);
  const openModal = useStudioStore(s => s.openModal);
  // Прогресс сыплется на каждый файл: без троттлинга статус-бар перерисовывается
  // сотни раз на проекте с большой библиотекой аудио.
  const lastTick = useRef(0);

  const throttledNotify = useCallback(
    (message: string) => {
      const now = Date.now();
      if (now - lastTick.current < 120) return;
      lastTick.current = now;
      notify(message);
    },
    [notify],
  );

  const runSave = useCallback(
    async (write: (blob: Blob, name: string) => Promise<SaveOutcome>) => {
      setBusy(true);
      notify('сохранение проекта…');
      try {
        const result = await serializeProject(p => {
          if (p.stage === 'fetch' && p.total > 0) throttledNotify(`сохранение · ассеты ${p.done}/${p.total}`);
          if (p.stage === 'zip') notify('сохранение · упаковка архива');
        });

        const outcome = await write(result.blob, result.suggestedName);
        if (outcome === 'cancelled') {
          notify('сохранение отменено');
          return;
        }

        const where = outcome === 'saved' ? getCurrentFileName() ?? result.suggestedName : result.suggestedName;
        const assets = `${result.images} ${pluralize(result.images, 'картинка', 'картинки', 'картинок')} · ${
          result.audio
        } ${pluralize(result.audio, 'трек', 'трека', 'треков')}`;
        const missing = describeMissing(result);

        // Имя в реестре — то же, что в файле: пикер должен показывать историю
        // так же, как её назвал автор.
        if (projectId) upsertProject(projectId, result.projectName);

        appendRunLog('ok', `проект сохранён · ${where} · ${assets}`);
        if (missing) {
          appendRunLog(
            'error',
            `в архив не попали: ${[...result.missingImages, ...result.missingAudio].slice(0, 10).join(', ')}`,
          );
        }
        notify(missing ? `проект сохранён · ${missing}` : `проект сохранён · ${where} · ${assets}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        appendRunLog('error', `сохранение не удалось · ${message}`);
        notify(`не удалось сохранить проект: ${message}`);
      } finally {
        setBusy(false);
      }
    },
    [notify, throttledNotify],
  );

  // Первое «Сохранить» в сессии всё равно спросит файл: handle не переживает
  // перезагрузку вкладки, а придумывать путь за пользователя мы не вправе.
  const saveProject = useCallback(() => runSave((blob, name) => saveBlobToCurrent(blob, name)), [runSave]);

  const saveProjectAs = useCallback(() => runSave((blob, name) => saveBlobAs(blob, name)), [runSave]);

  const pickAndStageOpen = useCallback(async () => {
    // Пикер — первым делом: любой await до него закрывает окно пользовательской
    // активации, и Chrome отказывает в доступе к файлам.
    let picked;
    try {
      picked = await pickProjectFile();
    } catch (e) {
      notify(`не удалось открыть файл: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (picked === 'cancelled') return;

    setBusy(true);
    notify('чтение файла проекта…');
    try {
      const parsed = await parseProjectFile(picked.file);
      if ('error' in parsed) {
        appendRunLog('error', `файл проекта не открыт · ${parsed.error}`);
        notify(`файл не открыт: ${parsed.error}`);
        return;
      }
      openModal({ kind: 'openProject', parsed, handle: picked.handle });
      notify(null);
    } finally {
      setBusy(false);
    }
  }, [notify, openModal]);

  return { busy, saveProject, saveProjectAs, pickAndStageOpen };
}
