import { beforeEach, describe, expect, it } from 'vitest';

import {
  addRunCost,
  estimateRunCost,
  formatCost,
  resetRunCost,
  resolveActualCost,
  STAGE_COST_EST,
  useRunCost,
} from './costModel';

import type { Brief } from './types';

const brief = (liCount: number, minutes: number): Brief =>
  ({
    loveInterests: Array.from({ length: liCount }, (_, i) => ({ id: `li${i}` })),
    scale: { targetDurationMinutes: minutes },
  } as unknown as Brief);

describe('costModel', () => {
  beforeEach(() => resetRunCost());

  it('счётчик копит вызовы и оценку по стадиям', () => {
    addRunCost('spine');
    addRunCost('dialogue_units');

    const { spent, calls } = useRunCost.getState();
    expect(calls).toBe(2);
    expect(spent).toBeCloseTo(STAGE_COST_EST.spine + STAGE_COST_EST.dialogue_units, 6);
  });

  it('стадии без LLM-вызова ничего не стоят', () => {
    addRunCost('schedule');
    addRunCost('prune');

    expect(useRunCost.getState().spent).toBe(0);
  });

  it('сброс обнуляет и деньги, и счётчик', () => {
    addRunCost('spine');
    resetRunCost();

    expect(useRunCost.getState()).toMatchObject({ spent: 0, calls: 0 });
  });

  it('оценка прогона растёт с числом персонажей', () => {
    expect(estimateRunCost(brief(3, 60))).toBeGreaterThan(estimateRunCost(brief(1, 60)));
  });

  it('без usage возвращается оценка стадии, с usage — фактическая цена', () => {
    expect(resolveActualCost(null, 'spine')).toEqual({ usd: STAGE_COST_EST.spine, estimated: true });

    const actual = resolveActualCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, 'spine');
    expect(actual).toEqual({ usd: 2, estimated: false });
  });

  it('суммы печатаются с двумя знаками', () => {
    expect(formatCost(0.2)).toBe('$0.20');
    expect(formatCost(0.214)).toBe('$0.21');
    expect(formatCost(1.278)).toBe('$1.28');
  });
});
