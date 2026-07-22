/**
 * Состояние истории — носитель, над которым работают guard-ы и effect-ы.
 *
 * Реализация спеки «Модель событий»: событие — функция от персонажа (x),
 * локации (y), времени (z), отношений (R) и кумулятива уже сработавших
 * событий (H). Guard — чистый предикат над контекстом, вся мутация — только
 * в effects.
 *
 * Модуль общий для генератора и рантайма: ровно эти типы сериализуются в
 * сейв прохождения и ровно они читаются симуляцией политик в story QA.
 */

export type CharacterId = string;
export type LocationId = string;
export type FlagId = string;

/**
 * Дискретный срез времени. Исторически соответствовал якорю outline
 * (anchorId/timeMarker); в календарной модели z = slot — глобальный индекс
 * (день × часть дня), а anchorId/timeMarker остаются для легаси-потребителей.
 */
export type TimeSlice = {
  z: number;
  anchorId?: string;
  timeMarker?: string;
  slot?: number;
  /** Малая стрелка: фаза ВНУТРИ части дня (см. PHASES_PER_SLOT). Нет → 0. */
  phase?: number;
};

/** Окно слотов [fromSlot, toSlot] включительно. */
export type SlotWindow = { fromSlot: number; toSlot: number };

/** Окно фаз [fromPhase, toPhase] внутри части дня — окно восприимчивости. */
export type PhaseWindow = { fromPhase: number; toPhase: number };

export type RelationshipState = {
  /** Спектр −1..1, как relationship[li].affection в game-компиляторе. */
  affection: number;
  trust: number;
  tension: number;
  /** Доп. переменные архетипа (external_pressure и т.п.). */
  vars?: Record<string, number>;
};

export type EventHistory = {
  flags: Set<FlagId>;
  /** Лог сработавших событий — кумулятив для последующих guard-ов. */
  fired: Array<{ eventId: string; z: number }>;
};

export type EventContext = {
  x: CharacterId;
  y: LocationId;
  z: TimeSlice;
  /** Отношения героини с x на момент оценки. */
  R: RelationshipState;
  /** Включая события, уже сработавшие в ЭТОМ срезе. */
  H: EventHistory;
};

/** Мутабельное состояние мира на границе среза. */
export type SliceState = {
  /** y каждого персонажа; null/отсутствие = за кадром. */
  positions: Record<CharacterId, LocationId | null>;
  /** Отношения героини по персонажам. */
  relationships: Record<CharacterId, RelationshipState>;
  flags: Set<FlagId>;
  fired: Array<{ eventId: string; z: number }>;
  unlocked: Set<string>;
  /** «Внутреннее» время среза для time-guard («21:00»); нет часов — guard ложен. */
  clock?: string;
};

export const DEFAULT_RELATIONSHIP: RelationshipState = { affection: 0, trust: 0, tension: 0 };

export function createSliceState(partial?: Partial<SliceState>): SliceState {
  return {
    positions: {},
    relationships: {},
    flags: new Set(),
    fired: [],
    unlocked: new Set(),
    ...partial,
  };
}
