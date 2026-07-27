import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { appendRunLog } from '@/narrative/runLog';
import { useStudioProjectStore } from '@/pages/studio/studioProjectStore';

import { usePrefabStore } from './prefabStore';
import { PREFAB_KIND_LABEL } from './prefabTypes';

import type { AudioVariationTone } from '@/narrative/narrativeStore';
import type { Prefab } from './prefabTypes';

/**
 * Применение префаба к текущему проекту. Правило одно: префаб добавляет и
 * заменяет своё, но не трогает чужого — вставка персонажа не сносит мир,
 * вставка мира не сносит каст. Хребет при этом устаревает, и об этом
 * говорится вслух: события ссылаются на локации, которых больше нет.
 */

export type ApplyResult = {
  ok: boolean;
  message: string;
  /** Хребет и всё ниже устарели: нужен новый прогон. */
  invalidatesStory: boolean;
};

export function applyPrefab(prefab: Prefab): ApplyResult {
  const narrative = useNarrativeStore.getState();
  const brief = useBriefStore.getState();

  let result: ApplyResult;

  switch (prefab.kind) {
    case 'character': {
      brief.addLoveInterestCard(prefab.payload.li);
      if (prefab.payload.sprite) narrative.setCharacter(prefab.payload.li.id, prefab.payload.sprite);
      for (const [tone, track] of Object.entries(prefab.payload.audio ?? {})) {
        narrative.setAudioVariation(prefab.payload.li.id, tone as AudioVariationTone, track);
      }
      result = {
        ok: true,
        message: `${prefab.payload.li.name || prefab.payload.li.id} добавлен в каст`,
        // Каст меняет агенды → расписание и пул событий врут.
        invalidatesStory: narrative.spine != null,
      };
      break;
    }

    case 'world': {
      narrative.setWorldModel(prefab.payload.worldModel);
      for (const [key, image] of Object.entries(prefab.payload.images)) {
        narrative.setImage(key, image);
      }
      result = {
        ok: true,
        message: `мир «${prefab.name}» подставлен (${prefab.payload.worldModel.locations.length} локаций)`,
        invalidatesStory: narrative.spine != null,
      };
      break;
    }

    case 'audio_set': {
      if (prefab.payload.base) narrative.setAudioBase(prefab.payload.base);
      for (const [mood, track] of Object.entries(prefab.payload.moodBeds)) {
        narrative.setAudioMoodBed(mood, track);
      }
      for (const [kind, track] of Object.entries(prefab.payload.specialBeds)) {
        narrative.setAudioSpecialBed(kind, track);
      }
      for (const [emotion, filename] of Object.entries(prefab.payload.sfx)) {
        narrative.setAudioSfx(emotion, filename);
      }
      // Аудио ни на что в тексте не влияет — историю не трогаем.
      result = { ok: true, message: `аудио-набор «${prefab.name}» подставлен`, invalidatesStory: false };
      break;
    }

    default:
      result = { ok: false, message: 'неизвестный тип префаба', invalidatesStory: false };
  }

  if (result.ok) {
    usePrefabStore.getState().markApplied(prefab.id);
    // Провенанс едет в файл проекта: сам префаб уже скопирован в сторы, но
    // без этой записи в открытом на другой машине проекте не видно, что
    // персонаж пришёл из библиотеки.
    useStudioProjectStore.getState().recordPrefabApplied({
      id: prefab.id,
      kind: prefab.kind,
      name: prefab.name,
      version: prefab.version,
      appliedAt: Date.now(),
    });
    appendRunLog('info', `префаб · ${PREFAB_KIND_LABEL[prefab.kind]} · ${result.message}`);
  }
  return result;
}

// ============================================================================
// СНЯТИЕ ПРЕФАБА С ТЕКУЩЕГО ПРОЕКТА
// ============================================================================

const newId = (prefix: string): string => `pf_${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/** Персонаж из брифа вместе с оплаченным спрайтом и его аудио-вариациями. */
export function captureCharacterPrefab(liId: string, origin: string): Prefab | null {
  const li = useBriefStore.getState().brief.loveInterests.find(l => l.id === liId);
  if (!li) return null;
  const narrative = useNarrativeStore.getState();
  const audio = narrative.audioByLi[liId] ?? null;

  return {
    id: newId('char'),
    kind: 'character',
    name: li.name || li.id,
    version: 1,
    forkOf: null,
    origin,
    createdAt: Date.now(),
    usedIn: 0,
    payload: {
      li,
      sprite: narrative.characters[liId] ?? null,
      audio,
    },
  };
}

/** Мир целиком: реестр локаций и нарисованные фоны. */
export function captureWorldPrefab(name: string, origin: string): Prefab | null {
  const narrative = useNarrativeStore.getState();
  if (!narrative.worldModel) return null;

  const images = Object.fromEntries(Object.entries(narrative.images).filter(([key]) => key.startsWith('loc:')));

  return {
    id: newId('world'),
    kind: 'world',
    name,
    version: 1,
    forkOf: null,
    origin,
    createdAt: Date.now(),
    usedIn: 0,
    payload: { worldModel: narrative.worldModel, images },
  };
}

/** Весь звук проекта, кроме персональных вариаций — они едут с персонажем. */
export function captureAudioPrefab(name: string, origin: string): Prefab {
  const narrative = useNarrativeStore.getState();
  return {
    id: newId('audio'),
    kind: 'audio_set',
    name,
    version: 1,
    forkOf: null,
    origin,
    createdAt: Date.now(),
    usedIn: 0,
    payload: {
      base: narrative.audioBase,
      moodBeds: narrative.audioMoodBeds,
      specialBeds: narrative.audioSpecialBeds,
      sfx: narrative.audioSfx,
    },
  };
}
