import { NARRATIVE_STORE_VERSION } from '@/narrative/narrativeMigrations';

import type { PersistedNarrativeState } from '@/narrative/narrativeMigrations';
import type { Brief } from '@/narrative/types';
import type { PrefabKind } from '@/prefabs/prefabTypes';
import type { SelectorConfig } from 'gu-engine-story-core';
import type { CastRef } from '../studioProjectStore';

/**
 * Формат файла проекта (.guproj) — ZIP с project.json и бинарными ассетами.
 *
 * Зачем архив, а не один JSON: спрайты и аудио весят десятки мегабайт, и
 * base64 раздул бы их ещё на треть, а разбор такого файла упирался бы в
 * JSON.parse. Ассеты лежат внутри как есть, состояние — отдельным файлом.
 *
 * Что НЕ едет в файл: библиотека префабов (она глобальная и переживает смену
 * истории), ключ OpenAI, лог прогона и счётчик расходов. Применённый префаб
 * копируется в проект целиком, поэтому файл самодостаточен и без библиотеки —
 * от неё остаётся только провенанс, чтобы было видно происхождение.
 */

export const GU_PROJECT_FORMAT = 'gu-project';
export const GU_PROJECT_SCHEMA_VERSION = 1;
export const GU_PROJECT_EXTENSION = '.guproj';
export const BRIEF_STORE_VERSION = 3;
export const STUDIO_STORE_VERSION = 1;

export const PROJECT_JSON_PATH = 'project.json';
export const IMAGES_PREFIX = 'assets/images/';
export const AUDIO_PREFIX = 'assets/audio/';

/** Следы применённых префабов: сам префаб уже скопирован в проект. */
export type PrefabProvenanceRef = {
  id: string;
  name: string;
  kind: PrefabKind;
  version: number;
  appliedAt: number;
};

/** Слайс нарративного стора без транзиентного черновика прогона. */
export type ProjectNarrativeSlice = Omit<PersistedNarrativeState, 'calendarRun'>;

/**
 * Что из истории едет в файл. Перечисление одно на сохранение и на открытие:
 * иначе поле, добавленное в стор, попадёт в архив, но не вернётся обратно.
 * calendarRun сюда не входит намеренно — незавершённый прогон привязан к
 * батчам конкретной вкладки и в чужом редакторе означает только зомби-статус.
 */
export function toProjectSlice(state: PersistedNarrativeState): ProjectNarrativeSlice {
  return {
    images: state.images,
    characters: state.characters,
    endings: state.endings,
    worldModel: state.worldModel,
    castPlan: state.castPlan,
    calendar: state.calendar,
    tagMap: state.tagMap,
    anchorNarrations: state.anchorNarrations,
    spine: state.spine,
    schedule: state.schedule,
    eventUnits: state.eventUnits,
    unitProse: state.unitProse,
    spineBeatProse: state.spineBeatProse,
    audioBase: state.audioBase,
    audioMoodBeds: state.audioMoodBeds,
    audioSpecialBeds: state.audioSpecialBeds,
    audioByLi: state.audioByLi,
    audioSfx: state.audioSfx,
    audioSfxState: state.audioSfxState,
    storyQA: state.storyQA,
  };
}

export type ProjectAssetsManifest = {
  /** Имена файлов, реально лежащих в архиве. */
  images: string[];
  audio: string[];
  /** Состояние на них ссылается, но забрать с сервера не вышло. */
  missingImages: string[];
  missingAudio: string[];
};

export type GuProjectJson = {
  format: typeof GU_PROJECT_FORMAT;
  schemaVersion: number;
  savedAt: string;
  projectName: string;
  /**
   * Стабильный идентификатор проекта — он же неймспейс всех ключей в
   * localStorage. Необязателен: файлы, сохранённые до появления многопроектности,
   * его не имеют, и при открытии такому проекту выдаётся новый id.
   */
  projectId?: string;
  stores: {
    brief: { version: number; state: { brief: Brief; selector: SelectorConfig } };
    narrative: { version: number; state: ProjectNarrativeSlice };
    studio: {
      version: number;
      state: { branchAssignment: Record<string, string>; castSlots: Record<string, CastRef> };
    };
  };
  prefabRefs: PrefabProvenanceRef[];
  assets: ProjectAssetsManifest;
};

export type ValidationOk = { ok: true; project: GuProjectJson; problems: string[] };
export type ValidationFail = { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const EMPTY_MANIFEST: ProjectAssetsManifest = { images: [], audio: [], missingImages: [], missingAudio: [] };

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter(v => typeof v === 'string') : []);

/**
 * Разбор project.json. Никогда не бросает: чужой или битый файл обязан
 * оставаться неломающимся входом — как разбор брифа в ImportBriefModal.
 * Жёстко отказываем только там, где применение испортило бы проект.
 */
export function validateProjectJson(value: unknown): ValidationOk | ValidationFail {
  if (!isRecord(value)) return { ok: false, error: 'project.json — не объект' };
  if (value.format !== GU_PROJECT_FORMAT) {
    return { ok: false, error: 'это не файл проекта GU Engine' };
  }

  const schemaVersion = typeof value.schemaVersion === 'number' ? value.schemaVersion : 0;
  if (schemaVersion > GU_PROJECT_SCHEMA_VERSION) {
    return { ok: false, error: 'файл создан более новой версией GU Engine — обновите редактор' };
  }

  if (!isRecord(value.stores)) return { ok: false, error: 'в файле нет секции stores' };
  const { brief: briefEntry, narrative: narrativeEntry, studio: studioEntry } = value.stores;

  if (!isRecord(briefEntry) || !isRecord(briefEntry.state) || !isRecord(briefEntry.state.brief)) {
    return { ok: false, error: 'в файле нет брифа' };
  }
  if (!Array.isArray((briefEntry.state.brief as Partial<Brief>).loveInterests)) {
    return { ok: false, error: 'в брифе нет массива loveInterests' };
  }
  if (!isRecord(narrativeEntry) || !isRecord(narrativeEntry.state)) {
    return { ok: false, error: 'в файле нет состояния истории' };
  }

  const narrativeVersion = typeof narrativeEntry.version === 'number' ? narrativeEntry.version : 0;
  if (narrativeVersion > NARRATIVE_STORE_VERSION) {
    return { ok: false, error: 'история сохранена более новой версией схемы — обновите редактор' };
  }
  const briefVersion = typeof briefEntry.version === 'number' ? briefEntry.version : 0;
  if (briefVersion > BRIEF_STORE_VERSION) {
    return { ok: false, error: 'бриф сохранён более новой версией схемы — обновите редактор' };
  }

  const problems: string[] = [];
  if (briefVersion < BRIEF_STORE_VERSION) {
    problems.push(`бриф из старой схемы (v${briefVersion}) — часть полей может быть пустой`);
  }
  if (narrativeVersion < NARRATIVE_STORE_VERSION) {
    problems.push(`история из старой схемы (v${narrativeVersion}) — будет мигрирована при открытии`);
  }
  if (!Array.isArray(value.prefabRefs)) problems.push('нет списка префабов — происхождение неизвестно');
  if (!isRecord(value.assets)) problems.push('нет манифеста ассетов — картинки берём из архива как есть');

  const assetsRaw = isRecord(value.assets) ? value.assets : {};
  const assets: ProjectAssetsManifest = {
    images: stringList(assetsRaw.images),
    audio: stringList(assetsRaw.audio),
    missingImages: stringList(assetsRaw.missingImages),
    missingAudio: stringList(assetsRaw.missingAudio),
  };
  if (assets.missingImages.length + assets.missingAudio.length > 0) {
    problems.push(
      `в архиве нет ${
        assets.missingImages.length + assets.missingAudio.length
      } ассетов — при сохранении сервер был недоступен`,
    );
  }

  const prefabRefs = Array.isArray(value.prefabRefs)
    ? (value.prefabRefs.filter(isRecord) as unknown as PrefabProvenanceRef[])
    : [];

  const project: GuProjectJson = {
    format: GU_PROJECT_FORMAT,
    schemaVersion,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
    projectName: typeof value.projectName === 'string' ? value.projectName : 'без названия',
    ...(typeof value.projectId === 'string' && value.projectId ? { projectId: value.projectId } : null),
    stores: {
      brief: {
        version: briefVersion,
        state: {
          brief: briefEntry.state.brief as Brief,
          selector: briefEntry.state.selector as SelectorConfig,
        },
      },
      narrative: { version: narrativeVersion, state: narrativeEntry.state as unknown as ProjectNarrativeSlice },
      studio: {
        version: isRecord(studioEntry) && typeof studioEntry.version === 'number' ? studioEntry.version : 0,
        state: {
          branchAssignment:
            isRecord(studioEntry) && isRecord(studioEntry.state) && isRecord(studioEntry.state.branchAssignment)
              ? (studioEntry.state.branchAssignment as Record<string, string>)
              : {},
          // Файл, записанный до кастинг-стола, приходит без слотов — роли в нём
          // закрыты именами из брифа, и пустой кастинг это честно отражает.
          castSlots:
            isRecord(studioEntry) && isRecord(studioEntry.state) && isRecord(studioEntry.state.castSlots)
              ? (studioEntry.state.castSlots as Record<string, CastRef>)
              : {},
        },
      },
    },
    prefabRefs,
    assets: isRecord(value.assets) ? assets : EMPTY_MANIFEST,
  };

  return { ok: true, project, problems };
}
