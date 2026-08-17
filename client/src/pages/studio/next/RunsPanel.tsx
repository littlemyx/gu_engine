import React, { useEffect, useMemo, useState } from 'react';

import { tailEvents, useEventBus } from '@/processes/eventBus';

import { deriveRuns } from '../derive/runsModel';

import styles from './shell.module.css';

import type { PipelineEvent } from '@/processes/events';
import type { RunOutcome, RunRow } from '../derive/runsModel';

/** Сколько событий поднимаем из журнала: хватает на несколько полных прогонов. */
const JOURNAL_DEPTH = 5000;

const OUTCOME_RU: Record<RunOutcome, string> = {
  committed: 'записан',
  failed: 'сбой',
  unfinished: 'не завершён',
};

/**
 * Вкладка «Прогоны»: история запусков из журнала событий.
 *
 * Журнал живёт в IndexedDB и поднимается при открытии вкладки; поверх него
 * дошиваются живые события зеркала — прогон, идущий прямо сейчас, виден в
 * списке с первых секунд, а не после коммита.
 */
const RunsPanel = () => {
  const recent = useEventBus(s => s.recent);
  const [journal, setJournal] = useState<PipelineEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void tailEvents(JOURNAL_DEPTH).then(events => {
      if (!alive) return;
      setJournal(events);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const runs = useMemo(() => {
    const known = new Set(journal.map(e => e.id));
    return deriveRuns([...journal, ...recent.filter(e => !known.has(e.id))]);
  }, [journal, recent]);

  if (!loaded && runs.length === 0) return <p className={styles.empty}>Читаю журнал…</p>;
  if (runs.length === 0) return <p className={styles.empty}>Прогонов ещё не было.</p>;

  return (
    <div>
      {runs.map(run => (
        <div key={run.runId} className={styles.feedLine}>
          <span className={styles.feedTime}>{when(run)}</span>
          <span>{OUTCOME_RU[run.outcome]}</span>
          <span>
            готово {run.done} · пропущено {run.skipped}
          </span>
          <span>{run.spent > 0 ? `≈$${run.spent.toFixed(2)}` : '$0'}</span>
          {run.reason && <span className={styles.feedTime}>{run.reason}</span>}
        </div>
      ))}
    </div>
  );
};

/** «16.08 14:32 · 4 мин» — когда стартовал и сколько шёл. */
function when(run: RunRow): string {
  const start = new Date(run.startedAt);
  const stamp = `${start.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })} ${start.toLocaleTimeString(
    'ru',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
  const minutes = Math.round((run.finishedAt - run.startedAt) / 60_000);
  return minutes > 0 ? `${stamp} · ${minutes} мин` : stamp;
}

export default RunsPanel;
