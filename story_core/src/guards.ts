/**
 * Guard — чистый предикат над контекстом события. Никакой мутации: всё
 * изменение состояния живёт в effects (см. effects.ts).
 *
 * Рекурсивная алгебра исполняется КАК ЕСТЬ и в генераторе, и в рантайме —
 * поэтому `any`/`not`/строгие сравнения легальны везде, без трансляции в
 * численные условия рёбер.
 */

import { bracketOfAffection, type AffectionBracket, type BracketThresholds } from './brackets';
import type { CharacterId, EventContext, FlagId, LocationId, SliceState } from './state';

export type Guard =
  | { all: Guard[] }
  | { any: Guard[] }
  | { not: Guard }
  | { flag: FlagId }
  | { fired: string }
  /**
   * Отношения. Без `char` читается R контекстного персонажа (ctx.x) — так
   * гейтятся ступени лестницы. С `char` — отношения с НАЗВАННЫМ персонажем:
   * это нужно концовкам, где условие охватывает всех сразу («все холодны»),
   * а контекстный персонаж один по определению.
   */
  | { rel: { char?: CharacterId; var: string; op: '<' | '<=' | '>' | '>='; value: number } }
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

/**
 * Число листьев guard-а — мера специфичности для салиенс-селектора.
 *
 * QBN-правило «самый ограниченный выигрывает»: юнит, требующий трёх условий,
 * написан под более узкую ситуацию, чем юнит с одним, и при прочих равных
 * должен вытеснять его — иначе узкий контент не будет показан никогда.
 */
export function guardLeafCount(guard: Guard): number {
  if ('all' in guard) return guard.all.reduce((n, g) => n + guardLeafCount(g), 0);
  if ('any' in guard) return guard.any.reduce((n, g) => n + guardLeafCount(g), 0);
  if ('not' in guard) return guardLeafCount(guard.not);
  return 1;
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

/**
 * Чистая оценка guard-а; не мутирует ни контекст, ни состояние.
 *
 * `thresholds` — пороги тона для bracket-guard-а; рантайм передаёт запечённые
 * пороги персонажа, generation-time потребители опускают (легаси-пороги).
 */
export function evalGuard(
  guard: Guard,
  ctx: EventContext,
  state: SliceState,
  thresholds?: BracketThresholds,
): boolean {
  if ('all' in guard) return guard.all.every(g => evalGuard(g, ctx, state, thresholds));
  if ('any' in guard) return guard.any.some(g => evalGuard(g, ctx, state, thresholds));
  if ('not' in guard) return !evalGuard(guard.not, ctx, state, thresholds);
  if ('flag' in guard) return ctx.H.flags.has(guard.flag);
  if ('fired' in guard) return ctx.H.fired.some(f => f.eventId === guard.fired);
  if ('rel' in guard) {
    // Именованный персонаж читается из состояния; без имени — контекстный.
    // Отсутствующие отношения — не «ноль», а «неизвестно»: guard ложен, иначе
    // концовка «все холодны» выигрывала бы у персонажа, которого игрок не встретил.
    const R = guard.rel.char ? state.relationships[guard.rel.char] : ctx.R;
    if (!R) return false;
    const value = guard.rel.var in R ? (R as unknown as Record<string, number>)[guard.rel.var] : R.vars?.[guard.rel.var];
    return typeof value === 'number' && cmp(guard.rel.op, value, guard.rel.value);
  }
  if ('bracket' in guard) return bracketOfAffection(ctx.R.affection, thresholds) === guard.bracket.is;
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

// ── Форматирование guard для UI (реестр событий, инспектор, ?gudebug) ───────

const GUARD_OP_TEXT: Record<string, string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' };

export function formatGuard(guard: Guard): string {
  if ('all' in guard) return guard.all.length === 0 ? 'true' : `all[ ${guard.all.map(formatGuard).join(', ')} ]`;
  if ('any' in guard) return `any[ ${guard.any.map(formatGuard).join(', ')} ]`;
  if ('not' in guard) return `not(${formatGuard(guard.not)})`;
  if ('flag' in guard) return `flag(${guard.flag})`;
  if ('fired' in guard) return `fired(${guard.fired})`;
  if ('rel' in guard) {
    const who = guard.rel.char ? `${guard.rel.char}.` : '';
    return `rel(${who}${guard.rel.var} ${GUARD_OP_TEXT[guard.rel.op]} ${guard.rel.value})`;
  }
  if ('bracket' in guard) return `bracket(${guard.bracket.of}) = ${guard.bracket.is}`;
  if ('time' in guard) return `time ${GUARD_OP_TEXT[guard.time.op]} ${guard.time.value}`;
  if ('slot' in guard) return `slot ${GUARD_OP_TEXT[guard.slot.op]} ${guard.slot.value}`;
  if ('at' in guard) return `at(${guard.at.char}, ${guard.at.loc})`;
  return '?';
}
