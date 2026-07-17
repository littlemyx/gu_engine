import { useCallback } from 'react';
import type { Brief } from './types';
import { useNarrativeStore } from './narrativeStore';
import { startCalendarRun } from './calendarRunner';
import {
  hasAnyDraft,
  TOTAL_STEPS,
  type BulkCalendarPhase,
  type BulkCalendarProgress,
  type BulkCalendarRunOptions,
} from './calendarRunState';

export type { BulkCalendarPhase, BulkCalendarProgress, BulkCalendarRunOptions };

/**
 * View-адаптер календарного прогона: сам прогон живёт в calendarRunner (вне
 * React) и держит состояние в сторе, а хук лишь читает его селекторами. Поэтому
 * прогон переживает размонтирование компонента и перезагрузку страницы —
 * после reload его дожимает initNarrative, а UI подхватывает прогресс из стора.
 */
const IDLE_PROGRESS: BulkCalendarProgress = { completed: 0, total: TOTAL_STEPS };
const NO_ISSUES: string[] = [];

export function useBulkCalendarGeneration() {
  const status = useNarrativeStore(s => s.calendarRun?.status ?? null);
  const runPhase = useNarrativeStore(s => s.calendarRun?.phase ?? null);
  const progress = useNarrativeStore(s => s.calendarRun?.progress ?? IDLE_PROGRESS);
  const error = useNarrativeStore(s => (s.calendarRun?.status === 'error' ? s.calendarRun.error : null));
  const issues = useNarrativeStore(s => s.calendarRun?.issues ?? NO_ISSUES);
  /** Есть незакоммиченный черновик упавшего прогона — кнопка «Продолжить». */
  const hasDraft = useNarrativeStore(s => s.calendarRun?.status === 'error' && hasAnyDraft(s.calendarRun.draft));
  const discardDraft = useNarrativeStore(s => s.discardCalendarRun);

  const run = useCallback((brief: Brief, options?: BulkCalendarRunOptions) => startCalendarRun(brief, options), []);

  const phase: BulkCalendarPhase = status === null || runPhase === null ? 'idle' : runPhase;

  return { run, phase, progress, error, issues, hasDraft, discardDraft };
}
