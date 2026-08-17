import { describe, expect, it } from 'vitest';

import { deriveRuns } from './runsModel';

import type { EventPhase, PipelineEvent } from '@/processes/events';

let n = 0;

function ev(runId: string, phase: EventPhase, ts: number, extra: Partial<PipelineEvent> = {}): PipelineEvent {
  n += 1;
  return { id: `e${n}`, ts, runId, phase, stage: 'spine', ...extra };
}

describe('deriveRuns', () => {
  it('пустой журнал — пустой список', () => {
    expect(deriveRuns([])).toEqual([]);
  });

  it('прогон с коммитом записан, деньги — из коммита, а не суммы событий', () => {
    const runs = deriveRuns([
      ev('a', 'plan', 100),
      ev('a', 'done', 200, { cost: 0.5 }),
      ev('a', 'skip', 250),
      ev('a', 'commit', 300, { cost: 1.7 }),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      runId: 'a',
      outcome: 'committed',
      done: 1,
      skipped: 1,
      spent: 1.7,
      startedAt: 100,
      finishedAt: 300,
    });
  });

  it('сбой без коммита — failed, причина с последнего fail', () => {
    const runs = deriveRuns([
      ev('a', 'plan', 100),
      ev('a', 'fail', 150, { reason: 'первый сбой' }),
      ev('a', 'fail', 200, { reason: 'второй сбой' }),
    ]);

    expect(runs[0].outcome).toBe('failed');
    expect(runs[0].reason).toBe('второй сбой');
  });

  // Сбой позиции, пережитый ретраем и доведённый до коммита, — не сбой прогона.
  it('коммит сильнее промежуточного сбоя', () => {
    const runs = deriveRuns([ev('a', 'fail', 100, { reason: 'ретрай спас' }), ev('a', 'commit', 200)]);

    expect(runs[0].outcome).toBe('committed');
  });

  it('без коммита и сбоя прогон не завершён, деньги — сумма событий', () => {
    const runs = deriveRuns([ev('a', 'attempt', 100, { cost: 0.2 }), ev('a', 'done', 200, { cost: 0.3 })]);

    expect(runs[0].outcome).toBe('unfinished');
    expect(runs[0].spent).toBeCloseTo(0.5);
  });

  it('прогоны разделены по runId, свежие сверху', () => {
    const runs = deriveRuns([ev('old', 'commit', 100), ev('new', 'plan', 500), ev('old2', 'commit', 300)]);

    expect(runs.map(r => r.runId)).toEqual(['new', 'old2', 'old']);
  });
});
