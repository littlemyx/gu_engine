import type { Brief, StoryAnchor, WorldLocation, LocationMood } from './types';
import { LOCATION_MOOD_LABELS, SPECIAL_AMBIENT_KIND_LABELS, isLocationMood } from './types';
import type { EventDef } from './events';

/**
 * Монтажная модель playground-а («Монтажный стол», макет 4a): срезы времени
 * z = топологический порядок якорей outline, позиции персонажей per-срез,
 * производный реестр EventDef и данные для ленты кадров / таймлайна /
 * мини-карты переходов.
 *
 * Источник правды — существующие артефакты пайплайна (outline, beatPlan,
 * dialogueVariants, worldModel); модель ничего не персистит, всё выводится
 * на лету. Маппинг по спеке «Модель событий» §5:
 *   - availableLIs  → участники + at(char, loc)
 *   - establishes   → state_change с setFlag-эффектами
 *   - dialogueVariants (positive/neutral/negative) → ветки bracket(affection)
 *   - смена локации между соседними срезами → move-событие
 */

export type MontageCharacter = {
  id: string;
  name: string;
  color: string;
  /** 1-2 буквы для фишки-токена. */
  initial: string;
  archetype: string;
};

export type SliceEventView = {
  def: EventDef;
  /** Сквозной номер-метка: e1, e2, … (связывает ромб на линии и карточку). */
  n: string;
  z: number;
  /** Основной участник (цвет ромба/карточки); null → нейтральный (акт). */
  charId: string | null;
  title: string;
  /** «Если» — компакт для карточки (полный guard — в инспекторе). */
  condText: string;
  effectText: string;
  hasScene: boolean;
  sceneStatus: { done: number; total: number } | null;
  kindIcon: string;
  /** Погашено селектором веток: guard требует флаг чужой ветки (календарь). */
  dimmed?: boolean;
};

export type MontageSlice = {
  z: number;
  anchor: StoryAnchor;
  locationId: string | null;
  locationName: string;
  /** Подпись эмбиента локации: «весёлая · клуб» или null. */
  ambientLabel: string | null;
  /** charId → locationId; отсутствие/null = за кадром. */
  placements: Record<string, string | null>;
  presentCharIds: string[];
  events: SliceEventView[];
};

export type CharacterMove = {
  charId: string;
  fromZ: number;
  toZ: number;
  fromLoc: string;
  toLoc: string;
};

export type MontageLocation = {
  id: string;
  name: string;
  shortName: string;
};

export type MontageModel = {
  slices: MontageSlice[];
  characters: MontageCharacter[];
  /** Смены локаций между соседними срезами (рёбра мини-карты, стрелки). */
  moves: CharacterMove[];
  /** Дорожки присутствия для таймлайна: charId → [zFrom, zTo] интервалы. */
  presence: Record<string, Array<[number, number]>>;
  locations: MontageLocation[];
  /** Допустимые пути между локациями (серые рёбра мини-карты). */
  adjacency: Array<[string, string]>;
  acts: Array<{ act: number; fromZ: number; toZ: number }>;
};

/** Палитра линий LI — в тон макету (Кира/Юки/Асель) + запас на большой каст. */
export const LI_LINE_PALETTE = ['#b45309', '#0369a1', '#be185d', '#0f766e', '#7c3aed', '#4d7c0f'];

export function liLineColor(index: number): string {
  return LI_LINE_PALETTE[index % LI_LINE_PALETTE.length];
}

export const shorten = (name: string, max = 8): string => {
  const first = name.split(/[,«»]/)[0].trim();
  return first.length <= max ? first : `${first.slice(0, max - 1)}.`;
};

export const truncate = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/** Подпись эмбиента локации («весёлая · клуб») — общая для обеих монтажных моделей. */
export function locationAmbientLabel(loc: WorldLocation | undefined | null): string | null {
  if (!loc) return null;
  const moodLabel = isLocationMood(loc.mood) ? LOCATION_MOOD_LABELS[loc.mood as LocationMood] : null;
  const specialLabel = loc.specialKind ? SPECIAL_AMBIENT_KIND_LABELS[loc.specialKind] : null;
  if (moodLabel && specialLabel) return `${moodLabel} · ${specialLabel}`;
  return specialLabel ?? moodLabel;
}

/** Персонажи-линии доски: LI брифа с палитрой liLineColor. */
export function deriveMontageCharacters(brief: Brief): MontageCharacter[] {
  return brief.loveInterests.map((li, i) => ({
    id: li.id,
    name: li.name || li.id,
    color: liLineColor(i),
    initial: (li.name || li.id).slice(0, 1).toUpperCase(),
    archetype: li.archetype,
  }));
}
