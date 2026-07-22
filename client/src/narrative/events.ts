/**
 * Модель событий: event = f(x, y, z, R, H) — ре-экспорт общего ядра.
 *
 * Сама алгебра переехала в пакет `gu-engine-story-core`, потому что её обязан
 * исполнять и генератор, и движок. Раньше семантика жила здесь, а для игры
 * компилятор ТРАНСЛИРОВАЛ её в численные условия рёбер — два исполнителя одних
 * правил неизбежно расходились (parity gap ±1 фаза). Теперь исполнитель один.
 *
 * Модуль остаётся точкой импорта для ~15 файлов narrative/: смысловой адрес
 * «модель событий» внутри пакета сохранён, менять их импорты незачем.
 */

export type {
  CharacterId,
  LocationId,
  FlagId,
  TimeSlice,
  SlotWindow,
  PhaseWindow,
  RelationshipState,
  EventHistory,
  EventContext,
  SliceState,
  AffectionBracket,
  Guard,
  Effect,
  EventKind,
  SceneRef,
  EventDef,
  SliceEvaluation,
} from 'gu-engine-story-core';

export {
  DEFAULT_RELATIONSHIP,
  createSliceState,
  bracketOfAffection,
  guardFiredIds,
  guardLeafCount,
  evalGuard,
  formatGuard,
  applyEffect,
  formatEffect,
  matchesSlice,
  evaluateSlice,
} from 'gu-engine-story-core';
