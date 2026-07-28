import { resolveScale } from './briefDefaults';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storageKey } from '@/project/projectScope';

import type { BulkCalendarPhase } from './calendarRunState';
import type { Brief } from './types';

/**
 * Стоимость прогона — ОЦЕНКА, не факт: text_gen не возвращает usage
 * (CompletedTextItem = {id, result}), и модель резолвится на его стороне.
 * Поэтому все суммы в UI печатаются со знаком «≈». Когда сервис начнёт
 * отдавать токены, точку подмены даёт resolveActualCost — остальной код
 * менять не придётся.
 */

/** Оценка цены одного LLM-вызова стадии, USD. */
export const STAGE_COST_EST: Record<BulkCalendarPhase, number> = {
  idle: 0,
  cast: 0.02,
  world_calendar: 0.03,
  spine: 0.05,
  schedule: 0,
  beat_prose: 0.012,
  anchor_transitions: 0.01,
  event_pool: 0.02,
  prune: 0,
  dialogue_units: 0.014,
  ending_prose: 0.012,
  done: 0,
};

/**
 * Стадии генерации брифа живут вне календарного прогона (свой автомат, свой
 * ретрай), поэтому в BulkCalendarPhase им места нет — но деньги те же, и
 * счётчик обязан их видеть.
 */
export const BRIEF_GEN_COST_EST = {
  hintParse: 0.002,
  fill: 0.01,
};

export type CostState = {
  /** Потрачено в текущем прогоне (оценка). */
  spent: number;
  /** Сколько вызовов уже сделано — для «14/24» в тулбаре. */
  calls: number;
  addCall: (phase: BulkCalendarPhase) => void;
  /** Вызов вне календарного прогона: цена известна, стадии в автомате нет. */
  addAmount: (usd: number) => void;
  reset: () => void;
};

export const useRunCost = create<CostState>()(
  persist(
    set => ({
      spent: 0,
      calls: 0,
      addCall: phase => set(s => ({ spent: s.spent + (STAGE_COST_EST[phase] ?? 0), calls: s.calls + 1 })),
      addAmount: usd => set(s => ({ spent: s.spent + usd, calls: s.calls + 1 })),
      reset: () => set({ spent: 0, calls: 0 }),
    }),
    { name: storageKey('gu-run-cost') },
  ),
);

export function addRunCost(phase: BulkCalendarPhase): void {
  useRunCost.getState().addCall(phase);
}

export function addRunCostAmount(usd: number): void {
  useRunCost.getState().addAmount(usd);
}

export function resetRunCost(): void {
  useRunCost.getState().reset();
}

/**
 * Оценка полной стоимости прогона по брифу: считаем вызовы, которые пайплайн
 * заведомо сделает — по одному на каркасные стадии и по числу LI на прозу.
 */
export function estimateRunCost(brief: Brief): number {
  const liCount = Math.max(1, brief.loveInterests.length);
  const days = Math.max(1, Math.round(resolveScale(brief.scale).targetDurationMinutes / 20));
  const beats = Math.max(6, days * 2);
  // Пул событий генерируется по персонажу, диалоги — по юниту в трёх брекетах.
  const units = liCount * 6;

  return (
    STAGE_COST_EST.cast +
    STAGE_COST_EST.world_calendar +
    STAGE_COST_EST.spine +
    STAGE_COST_EST.anchor_transitions +
    beats * STAGE_COST_EST.beat_prose +
    liCount * STAGE_COST_EST.event_pool +
    units * STAGE_COST_EST.dialogue_units +
    3 * STAGE_COST_EST.ending_prose
  );
}

/** «$0.21» — единый формат сумм. */
export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/**
 * Точка перехода на фактический учёт: как только text_gen начнёт возвращать
 * usage, эта функция вернёт реальную цену вместо оценки стадии.
 */
export function resolveActualCost(
  usage: { inputTokens: number; outputTokens: number } | null | undefined,
  phase: BulkCalendarPhase,
): { usd: number; estimated: boolean } {
  if (!usage) return { usd: STAGE_COST_EST[phase] ?? 0, estimated: true };
  // Прайс gpt-4.1-mini: $0.40/1M входных, $1.60/1M выходных.
  const usd = (usage.inputTokens * 0.4 + usage.outputTokens * 1.6) / 1_000_000;
  return { usd, estimated: false };
}
