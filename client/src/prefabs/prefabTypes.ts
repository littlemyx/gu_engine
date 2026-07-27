import type { AudioTrackState, CharacterGenState, ImageGenState, LiAudioState } from '@/narrative/narrativeStore';
import type { LoveInterestCard, WorldModel } from '@/narrative/types';

/**
 * Префаб — кусок истории, вынутый из проекта и переживающий его: персонаж,
 * мир или аудио-набор. Смысл в переиспользовании оплаченного: спрайт и фоны
 * стоят денег, и переносить их из истории в историю дешевле, чем рисовать
 * заново.
 */

export type PrefabKind = 'character' | 'world' | 'audio_set';

export const PREFAB_KIND_LABEL: Record<PrefabKind, string> = {
  character: 'персонаж',
  world: 'мир',
  audio_set: 'аудио-набор',
};

export const PREFAB_KIND_GLYPH: Record<PrefabKind, string> = {
  character: '◐',
  world: '▦',
  audio_set: '♪',
};

export type CharacterPayload = {
  li: LoveInterestCard;
  /** Оплаченный спрайт переезжает вместе с карточкой. */
  sprite: CharacterGenState | null;
  /** Вариации аудио персонажа по тонам. */
  audio: LiAudioState | null;
};

export type WorldPayload = {
  worldModel: WorldModel;
  /** Фоны локаций, ключ — `loc:<id>`, как в narrativeStore. */
  images: Record<string, ImageGenState>;
};

export type AudioSetPayload = {
  base: AudioTrackState | null;
  moodBeds: Record<string, AudioTrackState>;
  specialBeds: Record<string, AudioTrackState>;
  sfx: Record<string, string>;
};

export type Prefab =
  | (PrefabBase & { kind: 'character'; payload: CharacterPayload })
  | (PrefabBase & { kind: 'world'; payload: WorldPayload })
  | (PrefabBase & { kind: 'audio_set'; payload: AudioSetPayload });

export type PrefabBase = {
  id: string;
  name: string;
  /** Растёт при перезаписи префаба тем же автором. */
  version: number;
  /** id родителя, если префаб отпочкован от другого. */
  forkOf: string | null;
  /** Название истории, из которой вынут. */
  origin: string;
  createdAt: number;
  /** Сколько раз применён — «в N историях» на карточке. */
  usedIn: number;
};

/** Что показывает карточка префаба под названием. */
export function prefabSummary(prefab: Prefab): string {
  switch (prefab.kind) {
    case 'character':
      return prefab.payload.sprite?.status === 'done' ? 'со спрайтом' : 'без спрайта';
    case 'world': {
      const locations = prefab.payload.worldModel.locations.length;
      const backgrounds = Object.values(prefab.payload.images).filter(i => i.status === 'done').length;
      return `${locations} локаций · ${backgrounds} фонов`;
    }
    default: {
      const beds = Object.keys(prefab.payload.moodBeds).length + Object.keys(prefab.payload.specialBeds).length;
      return `${beds} эмбиентов · ${Object.keys(prefab.payload.sfx).length} sfx`;
    }
  }
}
