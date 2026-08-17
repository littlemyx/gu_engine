import { useBriefStore } from '@/narrative/briefStore';
import { slugify } from '@/narrative/convertToGameProject';
import { AUDIO_SERVER_BASE } from '@/narrative/audioResolver';
import { IMAGE_SERVER_BASE } from '@/narrative/emotionResolver';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { NARRATIVE_STORE_VERSION } from '@/narrative/narrativeMigrations';

import { projectId } from '@/project/projectScope';

import { useStudioProjectStore } from '../studioProjectStore';

import { collectAssetFilenames } from './assetFilenames';
import {
  AUDIO_PREFIX,
  BRIEF_STORE_VERSION,
  GU_PROJECT_EXTENSION,
  GU_PROJECT_FORMAT,
  GU_PROJECT_SCHEMA_VERSION,
  IMAGES_PREFIX,
  PROJECT_JSON_PATH,
  STUDIO_STORE_VERSION,
  toProjectSlice,
} from './projectFileFormat';
import { zipAsync } from './zipArchive';
import { strToU8 } from 'fflate';

import type { AssetKind } from './assetFilenames';
import type { GuProjectJson, ProjectNarrativeSlice } from './projectFileFormat';
import type { Zippable } from 'fflate';

/**
 * Сборка .guproj: состояние сторов + бинарники ассетов, забранные с локальных
 * серверов. Недоступный сервер сохранение НЕ валит — состояние стоит дороже
 * картинок: артефакты истории оплачены LLM-вызовами, а фон перерисовывается.
 * Не забранные файлы перечислены в манифесте, чтобы при открытии было видно,
 * чего в архиве нет.
 */

export type SaveStage = 'collect' | 'fetch' | 'zip';
export type SaveProgress = { stage: SaveStage; done: number; total: number };

export type SerializedProject = {
  blob: Blob;
  suggestedName: string;
  projectName: string;
  images: number;
  audio: number;
  missingImages: string[];
  missingAudio: string[];
};

/** Одновременных запросов к серверу ассетов: больше — только очередь в сети. */
const FETCH_CONCURRENCY = 4;

const assetUrl = (kind: AssetKind, filename: string): string =>
  kind === 'image'
    ? `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(filename)}`
    : `${AUDIO_SERVER_BASE}/audio/${encodeURIComponent(filename)}`;

/** Слайс проекта из живого стора: всё персистное, кроме черновика прогона. */
export const currentNarrativeSlice = (): ProjectNarrativeSlice => toProjectSlice(useNarrativeStore.getState());

/** Параллельная выборка с ограничением: возвращает байты и список неудач. */
async function fetchAssets(
  kind: AssetKind,
  names: string[],
  onFetched: () => void,
): Promise<{ files: Map<string, Uint8Array>; missing: string[] }> {
  const files = new Map<string, Uint8Array>();
  const missing: string[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (let i = cursor++; i < names.length; i = cursor++) {
      const name = names[i];
      try {
        const res = await fetch(assetUrl(kind, name));
        if (!res.ok) throw new Error(String(res.status));
        files.set(name, new Uint8Array(await res.arrayBuffer()));
      } catch {
        missing.push(name);
      }
      onFetched();
    }
  };

  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, names.length) }, worker));
  return { files, missing };
}

export function buildProjectJson(input: {
  narrative: ProjectNarrativeSlice;
  embeddedImages: string[];
  embeddedAudio: string[];
  missingImages: string[];
  missingAudio: string[];
  savedAt: string;
}): GuProjectJson {
  const briefState = useBriefStore.getState();
  const studioState = useStudioProjectStore.getState();
  const projectName = input.narrative.spine?.title || 'без названия';

  return {
    format: GU_PROJECT_FORMAT,
    schemaVersion: GU_PROJECT_SCHEMA_VERSION,
    savedAt: input.savedAt,
    projectName,
    // Файл уносит id вкладки: открытый заново, проект попадёт в свой же
    // неймспейс, а не создаст дубль с чужой историей генераций.
    ...(projectId ? { projectId } : null),
    stores: {
      brief: { version: BRIEF_STORE_VERSION, state: { brief: briefState.brief, selector: briefState.selector } },
      narrative: { version: NARRATIVE_STORE_VERSION, state: input.narrative },
      studio: {
        version: STUDIO_STORE_VERSION,
        state: {
          branchAssignment: studioState.branchAssignment,
          castSlots: studioState.castSlots,
          castIntent: studioState.castIntent,
        },
      },
    },
    prefabRefs: studioState.prefabProvenance,
    assets: {
      images: input.embeddedImages,
      audio: input.embeddedAudio,
      missingImages: input.missingImages,
      missingAudio: input.missingAudio,
    },
  };
}

export async function serializeProject(onProgress?: (p: SaveProgress) => void): Promise<SerializedProject> {
  const narrative = currentNarrativeSlice();

  onProgress?.({ stage: 'collect', done: 0, total: 0 });
  const referenced = collectAssetFilenames(narrative);
  const imageNames = [...referenced.images];
  const audioNames = [...referenced.audio];
  const total = imageNames.length + audioNames.length;

  let done = 0;
  const tick = () => onProgress?.({ stage: 'fetch', done: ++done, total });

  const [images, audio] = await Promise.all([
    fetchAssets('image', imageNames, tick),
    fetchAssets('audio', audioNames, tick),
  ]);

  onProgress?.({ stage: 'zip', done: total, total });

  const savedAt = new Date().toISOString();
  const project = buildProjectJson({
    narrative,
    embeddedImages: [...images.files.keys()],
    embeddedAudio: [...audio.files.keys()],
    missingImages: images.missing,
    missingAudio: audio.missing,
    savedAt,
  });

  // Ассеты уже сжаты (PNG/MP3) — level 0 экономит секунды на десятках мегабайт.
  const entries: Zippable = { [PROJECT_JSON_PATH]: [strToU8(JSON.stringify(project, null, 2)), { level: 6 }] };
  for (const [name, bytes] of images.files) entries[`${IMAGES_PREFIX}${name}`] = [bytes, { level: 0 }];
  for (const [name, bytes] of audio.files) entries[`${AUDIO_PREFIX}${name}`] = [bytes, { level: 0 }];

  const archive = await zipAsync(entries);

  return {
    blob: new Blob([archive], { type: 'application/zip' }),
    suggestedName: `${slugify(project.projectName)}${GU_PROJECT_EXTENSION}`,
    projectName: project.projectName,
    images: images.files.size,
    audio: audio.files.size,
    missingImages: images.missing,
    missingAudio: audio.missing,
  };
}
