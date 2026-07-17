import { BRACKET_POSITIVE_GTE, BRACKET_NEGATIVE_LTE } from './convertToGameProject';

/**
 * Модель событий: event = f(x, y, z, R, H).
 *
 * Реализация спеки «Модель событий» (claude.ai/design · Админка графической
 * новеллы): событие — функция от персонажа (x), локации (y), времени (z),
 * отношений (R) и кумулятива уже сработавших событий (H). Guard — чистый
 * предикат над контекстом, вся мутация — только в effects.
 *
 * Оценка среза детерминирована: события сортируются по priority (тай-брейк —
 * лексикографически по id) и оцениваются до 3 проходов, потому что
 * move-эффекты могут открыть новые co-location события («ушёл-пришёл»
 * ограничен, срез фиксируется).
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

export type EventKind = 'dialogue' | 'move_out' | 'move_in' | 'ambient' | 'state_change';

export type AffectionBracket = 'warm' | 'neutral' | 'cold';

/** Ссылка на сцену события в существующем пайплайне. null = триггер без сцены. */
export type SceneRef = { kind: 'dialogue'; anchorId: string; liId: string } | { kind: 'beat'; anchorId: string };

export type Guard =
  | { all: Guard[] }
  | { any: Guard[] }
  | { not: Guard }
  | { flag: FlagId }
  | { fired: string }
  | { rel: { var: string; op: '<' | '<=' | '>' | '>='; value: number } }
  | { bracket: { of: 'affection'; is: AffectionBracket } }
  | { time: { op: '>=' | '<'; value: string } }
  | { slot: { op: '>=' | '<='; value: number } }
  | { at: { char: CharacterId; loc: LocationId } };

/**
 * id fired-зависимостей guard-а. Живёт рядом с Guard, а не в parseEventPool:
 * обход нужен и цепочке битов (beatChain), а parseEventPool тянет guardFlags из
 * validateSpine — импорт оттуда замкнул бы validateSpine → beatChain →
 * parseEventPool → validateSpine.
 */
export function guardFiredIds(guard: Guard): string[] {
  if ('all' in guard) return guard.all.flatMap(guardFiredIds);
  if ('any' in guard) return guard.any.flatMap(guardFiredIds);
  if ('not' in guard) return guardFiredIds(guard.not);
  if ('fired' in guard) return [guard.fired];
  return [];
}

export type Effect =
  | { rel: { char: CharacterId; var: string; delta: number; clamp?: [number, number] } }
  | { setFlag: FlagId }
  | { move: { char: CharacterId; to: LocationId } }
  | { unlock: { eventId: string } };

export type EventDef = {
  id: string;
  kind: EventKind;
  /**
   * Маска привязки к y/z: событие рассматривается только в подходящем срезе.
   * `phase` — окно восприимчивости внутри части дня (нет → фаза любая).
   */
  at: { anchorId?: string; locationId?: LocationId; slot?: SlotWindow; phase?: PhaseWindow };
  participants: CharacterId[];
  /** «Если» — чистый предикат над EventContext. */
  guard: Guard;
  /** «Эффект» — атомарные патчи состояния. */
  effects: Effect[];
  scene?: SceneRef | null;
  /** Порядок оценки внутри среза; меньше = раньше. */
  priority: number;
  /** Заблокировано до unlock-эффекта другого события. */
  locked?: boolean;
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

/**
 * Бакет тона по affection. Пороги — те же константы, что ведут диалоговые
 * ветки и аудио-профили (единственная точка истины в convertToGameProject).
 */
export function bracketOfAffection(affection: number): AffectionBracket {
  if (affection >= BRACKET_POSITIVE_GTE) return 'warm';
  if (affection <= BRACKET_NEGATIVE_LTE) return 'cold';
  return 'neutral';
}

const cmp = (op: '<' | '<=' | '>' | '>=', a: number, b: number): boolean => {
  switch (op) {
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
  }
};

/** «HH:MM» → минуты; некорректный формат → NaN (guard будет ложен). */
const clockMinutes = (v: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** Чистая оценка guard-а; не мутирует ни контекст, ни состояние. */
export function evalGuard(guard: Guard, ctx: EventContext, state: SliceState): boolean {
  if ('all' in guard) return guard.all.every(g => evalGuard(g, ctx, state));
  if ('any' in guard) return guard.any.some(g => evalGuard(g, ctx, state));
  if ('not' in guard) return !evalGuard(guard.not, ctx, state);
  if ('flag' in guard) return ctx.H.flags.has(guard.flag);
  if ('fired' in guard) return ctx.H.fired.some(f => f.eventId === guard.fired);
  if ('rel' in guard) {
    const value =
      guard.rel.var in ctx.R
        ? (ctx.R as unknown as Record<string, number>)[guard.rel.var]
        : ctx.R.vars?.[guard.rel.var];
    return typeof value === 'number' && cmp(guard.rel.op, value, guard.rel.value);
  }
  if ('bracket' in guard) return bracketOfAffection(ctx.R.affection) === guard.bracket.is;
  if ('time' in guard) {
    if (!state.clock) return false;
    const now = clockMinutes(state.clock);
    const at = clockMinutes(guard.time.value);
    if (Number.isNaN(now) || Number.isNaN(at)) return false;
    return guard.time.op === '>=' ? now >= at : now < at;
  }
  if ('slot' in guard) {
    const current = ctx.z.slot ?? ctx.z.z;
    return guard.slot.op === '>=' ? current >= guard.slot.value : current <= guard.slot.value;
  }
  if ('at' in guard) return state.positions[guard.at.char] === guard.at.loc;
  return false;
}

function applyEffect(effect: Effect, state: SliceState): void {
  if ('rel' in effect) {
    const { char, var: varName, delta, clamp } = effect.rel;
    const rel: RelationshipState = state.relationships[char] ?? { ...DEFAULT_RELATIONSHIP };
    const core = rel as unknown as Record<string, number>;
    if (varName === 'affection' || varName === 'trust' || varName === 'tension') {
      let next = (core[varName] ?? 0) + delta;
      if (clamp) next = Math.max(clamp[0], Math.min(clamp[1], next));
      core[varName] = next;
    } else {
      const vars = { ...(rel.vars ?? {}) };
      let next = (vars[varName] ?? 0) + delta;
      if (clamp) next = Math.max(clamp[0], Math.min(clamp[1], next));
      vars[varName] = next;
      rel.vars = vars;
    }
    state.relationships[char] = rel;
    return;
  }
  if ('setFlag' in effect) {
    state.flags.add(effect.setFlag);
    return;
  }
  if ('move' in effect) {
    state.positions[effect.move.char] = effect.move.to;
    return;
  }
  if ('unlock' in effect) {
    state.unlocked.add(effect.unlock.eventId);
  }
}

/** Событие попадает в срез, если его at-маска совпадает с z (и локацией среза). */
export function matchesSlice(def: EventDef, slice: TimeSlice, sliceLocationId?: string | null): boolean {
  if (def.at.anchorId && def.at.anchorId !== slice.anchorId) return false;
  if (def.at.slot) {
    const current = slice.slot ?? slice.z;
    if (current < def.at.slot.fromSlot || current > def.at.slot.toSlot) return false;
  }
  // Малая стрелка: окна фаз нет → событие фаза-агностично (биты хребта).
  if (def.at.phase) {
    const phase = slice.phase ?? 0;
    if (phase < def.at.phase.fromPhase || phase > def.at.phase.toPhase) return false;
  }
  if (def.at.locationId && !def.at.anchorId && def.at.locationId !== sliceLocationId) return false;
  return true;
}

export type SliceEvaluation = {
  /** Сработавшие в этом срезе события в порядке срабатывания. */
  fired: EventDef[];
  /** Очередь сцен сработавших событий. */
  scenes: SceneRef[];
  /** Состояние после фиксации среза (тот же объект state — мутируется). */
  state: SliceState;
  /** Проходов потрачено (диагностика лимита каскадов). */
  passes: number;
};

const MAX_PASSES = 3;

/**
 * Оценка среза z по спеке §3: события сортируются по (priority, id),
 * оцениваются до 3 проходов; каждое срабатывание атомарно применяет effects
 * и пишется в H.fired, так что последующие guard-ы того же среза видят
 * кумулятив («Кира уходит, если героиня выбрала Юки»).
 *
 * События, уже присутствующие в state.fired (из прошлых срезов), повторно
 * не срабатывают: событие одноразово по построению лога.
 */
export function evaluateSlice(
  defs: EventDef[],
  slice: TimeSlice,
  state: SliceState,
  sliceLocationId?: string | null,
): SliceEvaluation {
  const candidates = defs
    .filter(d => matchesSlice(d, slice, sliceLocationId))
    .sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const firedIds = new Set(state.fired.map(f => f.eventId));
  const fired: EventDef[] = [];
  const scenes: SceneRef[] = [];

  const history: EventHistory = { flags: state.flags, fired: state.fired };
  const contextFor = (def: EventDef): EventContext => {
    const x = def.participants[0] ?? '';
    return {
      x,
      y: state.positions[x] ?? def.at.locationId ?? '',
      z: slice,
      R: state.relationships[x] ?? DEFAULT_RELATIONSHIP,
      H: history,
    };
  };

  let passes = 0;
  for (; passes < MAX_PASSES; passes++) {
    let firedThisPass = false;
    for (const def of candidates) {
      if (firedIds.has(def.id)) continue;
      if (def.locked && !state.unlocked.has(def.id)) continue;
      if (!evalGuard(def.guard, contextFor(def), state)) continue;
      for (const effect of def.effects) applyEffect(effect, state);
      state.fired.push({ eventId: def.id, z: slice.z });
      firedIds.add(def.id);
      fired.push(def);
      if (def.scene) scenes.push(def.scene);
      firedThisPass = true;
    }
    if (!firedThisPass) break;
  }

  return { fired, scenes, state, passes };
}

// ── Форматирование guard/effects для UI (реестр событий, инспектор) ────────

const GUARD_OP_TEXT: Record<string, string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' };

export function formatGuard(guard: Guard): string {
  if ('all' in guard) return guard.all.length === 0 ? 'true' : `all[ ${guard.all.map(formatGuard).join(', ')} ]`;
  if ('any' in guard) return `any[ ${guard.any.map(formatGuard).join(', ')} ]`;
  if ('not' in guard) return `not(${formatGuard(guard.not)})`;
  if ('flag' in guard) return `flag(${guard.flag})`;
  if ('fired' in guard) return `fired(${guard.fired})`;
  if ('rel' in guard) return `rel(${guard.rel.var} ${GUARD_OP_TEXT[guard.rel.op]} ${guard.rel.value})`;
  if ('bracket' in guard) return `bracket(${guard.bracket.of}) = ${guard.bracket.is}`;
  if ('time' in guard) return `time ${GUARD_OP_TEXT[guard.time.op]} ${guard.time.value}`;
  if ('slot' in guard) return `slot ${GUARD_OP_TEXT[guard.slot.op]} ${guard.slot.value}`;
  if ('at' in guard) return `at(${guard.at.char}, ${guard.at.loc})`;
  return '?';
}

export function formatEffect(effect: Effect): string {
  if ('rel' in effect) {
    const sign = effect.rel.delta >= 0 ? '+' : '−';
    return `rel(${effect.rel.char}, ${effect.rel.var}, ${sign}${Math.abs(effect.rel.delta)})`;
  }
  if ('setFlag' in effect) return `setFlag(${effect.setFlag})`;
  if ('move' in effect) return `move(${effect.move.char} → ${effect.move.to})`;
  if ('unlock' in effect) return `unlock(${effect.unlock.eventId})`;
  return '?';
}
