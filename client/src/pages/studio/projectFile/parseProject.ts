import { strFromU8 } from 'fflate';

import { AUDIO_SERVER_BASE } from '@/narrative/audioResolver';
import { useBriefStore } from '@/narrative/briefStore';
import { IMAGE_SERVER_BASE } from '@/narrative/emotionResolver';
import { migratePersistedNarrativeState } from '@/narrative/narrativeMigrations';
import { EMPTY_NARRATIVE_DATA, useNarrativeStore } from '@/narrative/narrativeStore';

import { upsertProject } from '@/project/projectRegistry';
import { newProjectId, projectId, studioUrl } from '@/project/projectScope';
import { writeProjectSnapshot } from '@/project/writeProjectSnapshot';

import { useStudioProjectStore } from '../studioProjectStore';
import { useStudioStore } from '../studioStore';

import { remapAssetFilenames } from './assetFilenames';
import { clearCurrentHandle } from './fileHandle';
import {
  AUDIO_PREFIX,
  IMAGES_PREFIX,
  PROJECT_JSON_PATH,
  toProjectSlice,
  validateProjectJson,
} from './projectFileFormat';
import { unzipAsync } from './zipArchive';

import type { StudioProjectData } from '../studioProjectStore';
import type { AssetKind } from './assetFilenames';
import type { GuProjectJson, ProjectNarrativeSlice } from './projectFileFormat';

/**
 * Открытие .guproj. Разбор отделён от применения намеренно: пользователь
 * подтверждает перезапись текущей работы, уже видя, что лежит в файле.
 *
 * Ассеты внутри архива названы так, как их звали на сервере при сохранении,
 * но серверы при загрузке всегда выдают файлу НОВОЕ имя — поэтому применение
 * строит карту старое→новое и переписывает ссылки в состоянии. Файлы, которые
 * на сервере уже есть под тем же именем (открываем проект на той же машине),
 * не перезаливаются вовсе.
 */

export type ProjectSummary = {
  name: string;
  savedAt: string;
  images: number;
  audio: number;
  loveInterests: number;
  hasSpine: boolean;
  prefabs: number;
};

export type ParsedProject = {
  project: GuProjectJson;
  problems: string[];
  files: { images: Map<string, Uint8Array>; audio: Map<string, Uint8Array> };
  summary: ProjectSummary;
};

export type OpenStage = 'upload' | 'apply';
export type OpenProgress = { stage: OpenStage; done: number; total: number };

export type ApplyOutcome =
  | {
      ok: true;
      failedUploads: string[];
      reusedExisting: number;
      uploaded: number;
      /** Вкладка уходит на другой проект: сообщать об успехе будет уже она. */
      navigated: boolean;
    }
  | { ok: false; error: string };

/**
 * Куда применять файл: в живые сторы этой вкладки или в чужой неймспейс с
 * последующей навигацией.
 *
 * Правило — «файл возвращается туда, откуда пришёл». Свой же файл (id совпал)
 * и файл без id (сохранён до многопроектности) ложатся в текущий проект: автор
 * нажал «Открыть» в окне своего проекта и ждёт замены содержимого. Файл чужого
 * проекта открывается как отдельный проект, иначе его прогоны и медиа-батчи
 * смешались бы с историей вкладки. Непривязанная вкладка (пикер) всегда уходит
 * на конкретный проект — применять ей просто не во что.
 */
export type ApplyTarget = { mode: 'inPlace' } | { mode: 'navigate'; id: string };

export function decideApplyTarget(fileId: string | undefined, tabId: string | null, freshId: string): ApplyTarget {
  if (tabId == null) return { mode: 'navigate', id: fileId || freshId };
  if (!fileId || fileId === tabId) return { mode: 'inPlace' };
  return { mode: 'navigate', id: fileId };
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp3: 'audio/mp3',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

const mimeFor = (kind: AssetKind, filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? (kind === 'image' ? 'image/png' : 'audio/mp3');
};

/** Разбор архива. Не бросает: битый файл — сообщение, а не падение шелла. */
export async function parseProjectFile(file: File): Promise<ParsedProject | { error: string }> {
  let entries;
  try {
    entries = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { error: `не читается как архив: ${e instanceof Error ? e.message : String(e)}` };
  }

  const raw = entries[PROJECT_JSON_PATH];
  if (!raw) return { error: 'в архиве нет project.json — это не файл проекта' };

  let value: unknown;
  try {
    value = JSON.parse(strFromU8(raw));
  } catch (e) {
    return { error: `project.json не разобран: ${e instanceof Error ? e.message : String(e)}` };
  }

  const validated = validateProjectJson(value);
  if (!validated.ok) return { error: validated.error };

  const images = new Map<string, Uint8Array>();
  const audio = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith(IMAGES_PREFIX)) images.set(path.slice(IMAGES_PREFIX.length), bytes);
    else if (path.startsWith(AUDIO_PREFIX)) audio.set(path.slice(AUDIO_PREFIX.length), bytes);
  }

  const { project } = validated;
  return {
    project,
    problems: validated.problems,
    files: { images, audio },
    summary: {
      name: project.projectName,
      savedAt: project.savedAt,
      images: images.size,
      audio: audio.size,
      loveInterests: project.stores.brief.state.brief.loveInterests?.length ?? 0,
      hasSpine: project.stores.narrative.state.spine != null,
      prefabs: project.prefabRefs.length,
    },
  };
}

/** Имена файлов, уже лежащих на сервере: их не надо заливать заново. */
async function listExisting(kind: AssetKind): Promise<Set<string>> {
  const url = kind === 'image' ? `${IMAGE_SERVER_BASE}/images` : `${AUDIO_SERVER_BASE}/audio`;
  try {
    const res = await fetch(url);
    if (!res.ok) return new Set();
    const list = (await res.json()) as unknown;
    if (!Array.isArray(list)) return new Set();
    return new Set(
      list
        .map(item => (typeof item === 'string' ? item : (item as { name?: unknown })?.name))
        .filter((name): name is string => typeof name === 'string'),
    );
  } catch {
    return new Set();
  }
}

type UploadResult = { map: Map<string, string>; failed: string[]; reused: number; uploaded: number };

async function uploadAssets(
  kind: AssetKind,
  files: Map<string, Uint8Array>,
  existing: Set<string>,
  onDone: () => void,
): Promise<UploadResult> {
  const url = kind === 'image' ? `${IMAGE_SERVER_BASE}/images` : `${AUDIO_SERVER_BASE}/audio`;
  const field = kind === 'image' ? 'image' : 'audio';
  const map = new Map<string, string>();
  const failed: string[] = [];
  let reused = 0;
  let uploaded = 0;

  for (const [name, bytes] of files) {
    if (existing.has(name)) {
      reused++;
      onDone();
      continue;
    }
    try {
      const form = new FormData();
      // Копия буфера: fflate отдаёт вьюхи в общий буфер архива, а Blob обязан
      // владеть своими байтами — иначе в файл уедет соседний ассет.
      form.append(field, new File([bytes.slice()], name, { type: mimeFor(kind, name) }));
      const res = await fetch(url, { method: 'POST', body: form });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { name?: string };
      if (typeof body.name !== 'string') throw new Error('сервер не вернул имя файла');
      if (body.name !== name) map.set(name, body.name);
      uploaded++;
    } catch {
      failed.push(name);
    }
    onDone();
  }

  return { map, failed, reused, uploaded };
}

/**
 * Применение разобранного проекта. Вся сетевая работа идёт ДО первой записи
 * в сторы: сорванное открытие обязано оставить автора с той историей, что у
 * него была, а не с половиной чужой.
 */
export async function applyProject(
  parsed: ParsedProject,
  options: {
    onProgress?: (p: OpenProgress) => void;
    /** Куда применять. По умолчанию решает decideApplyTarget по id вкладки. */
    target?: ApplyTarget;
  } = {},
): Promise<ApplyOutcome> {
  const { onProgress } = options;
  const { project, files } = parsed;

  let narrative: ProjectNarrativeSlice;
  try {
    // Миграция та же, что у zustand при апгрейде схемы: старый .guproj
    // дозаполняется дефолтами, а не отвергается.
    narrative = toProjectSlice(migratePersistedNarrativeState(project.stores.narrative.state));
  } catch (e) {
    return { ok: false, error: `состояние истории не мигрируется: ${e instanceof Error ? e.message : String(e)}` };
  }

  const total = files.images.size + files.audio.size;
  let done = 0;
  const tick = () => onProgress?.({ stage: 'upload', done: ++done, total });

  const [existingImages, existingAudio] = await Promise.all([listExisting('image'), listExisting('audio')]);
  const imageUpload = await uploadAssets('image', files.images, existingImages, tick);
  const audioUpload = await uploadAssets('audio', files.audio, existingAudio, tick);

  onProgress?.({ stage: 'apply', done: total, total });
  const remapped = remapAssetFilenames(narrative, imageUpload.map, audioUpload.map);

  const studioData: StudioProjectData = {
    branchAssignment: project.stores.studio.state.branchAssignment,
    prefabProvenance: project.prefabRefs,
    scriptBracket: 'neutral',
    castSlots: project.stores.studio.state.castSlots ?? {},
    castIntent: project.stores.studio.state.castIntent ?? {},
  };
  const briefState = project.stores.brief.state;
  const target = options.target ?? decideApplyTarget(project.projectId, projectId, newProjectId());
  const counters = {
    failedUploads: [...imageUpload.failed, ...audioUpload.failed],
    reusedExisting: imageUpload.reused + audioUpload.reused,
    uploaded: imageUpload.uploaded + audioUpload.uploaded,
  };

  if (target.mode === 'navigate') {
    try {
      writeProjectSnapshot(target.id, {
        narrative: remapped,
        brief: { brief: briefState.brief, selector: briefState.selector },
        studio: studioData,
      });
    } catch (e) {
      return { ok: false, error: `состояние не записано в хранилище: ${e instanceof Error ? e.message : String(e)}` };
    }
    upsertProject(target.id, project.projectName);
    // Дальше историю подхватит новая загрузка страницы: сторы этой вкладки
    // привязаны к другому проекту и трогать их нельзя.
    window.location.assign(studioUrl(target.id));
    return { ok: true, ...counters, navigated: true };
  }

  useBriefStore.setState({
    brief: briefState.brief,
    ...(briefState.selector ? { selector: briefState.selector } : null),
  });
  // EMPTY_NARRATIVE_DATA первым слоем: поле, которого нет в открываемом файле,
  // обязано обнулиться, а не остаться от предыдущей истории.
  useNarrativeStore.setState({ ...EMPTY_NARRATIVE_DATA, ...remapped, calendarRun: null });
  useStudioProjectStore.setState(studioData);
  useStudioStore.setState({ selection: null });
  clearCurrentHandle();
  if (projectId) upsertProject(projectId, project.projectName);

  return { ok: true, ...counters, navigated: false };
}
