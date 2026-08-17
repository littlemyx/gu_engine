import type { PipelineEvent } from '@/processes/events';

/**
 * Вкладка «Прогоны»: история запусков, сведённая из журнала событий.
 *
 * Отдельного стора прогонов нет и не нужно: каждый прогон уже рассказал о себе
 * событиями (план → позиции → коммит), и список прогонов — это группировка
 * журнала по runId. Заводить под него вторую запись значило бы разрешить
 * журналу и списку разойтись.
 */

export type RunOutcome =
  /** Дошёл до коммита: история обновлена. */
  | 'committed'
  /** Есть сбой и нет коммита. */
  | 'failed'
  /** Ни коммита, ни сбоя: идёт прямо сейчас или оборван (перезагрузкой, стопом). */
  | 'unfinished';

export interface RunRow {
  runId: string;
  startedAt: number;
  finishedAt: number;
  outcome: RunOutcome;
  /** Позиций доведено до «готово». */
  done: number;
  /** Позиций пропущено (кэш/замок). */
  skipped: number;
  /**
   * Потрачено за прогон. Коммит несёт итог по счётчику прогона — он точнее
   * суммы событий (события пишутся без ожидания и могут потеряться).
   */
  spent: number;
  /** Причина сбоя — с последнего fail-события. */
  reason?: string;
}

export function deriveRuns(events: PipelineEvent[]): RunRow[] {
  const byRun = new Map<string, PipelineEvent[]>();
  for (const event of events) {
    const list = byRun.get(event.runId);
    if (list) list.push(event);
    else byRun.set(event.runId, [event]);
  }

  const rows = [...byRun.values()].map(summarize);
  // Свежие сверху: список отвечает на «что случилось только что», а не «с чего
  // всё началось».
  return rows.sort((a, b) => b.startedAt - a.startedAt);
}

function summarize(events: PipelineEvent[]): RunRow {
  const commit = events.find(e => e.phase === 'commit');
  const fails = events.filter(e => e.phase === 'fail');

  return {
    runId: events[0].runId,
    startedAt: Math.min(...events.map(e => e.ts)),
    finishedAt: Math.max(...events.map(e => e.ts)),
    outcome: commit ? 'committed' : fails.length > 0 ? 'failed' : 'unfinished',
    done: events.filter(e => e.phase === 'done').length,
    skipped: events.filter(e => e.phase === 'skip').length,
    spent: commit?.cost ?? events.reduce((sum, e) => sum + (e.cost ?? 0), 0),
    reason: fails.at(-1)?.reason,
  };
}
