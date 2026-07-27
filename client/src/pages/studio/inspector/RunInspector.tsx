import React from 'react';

import { formatCost, useRunCost } from '@/narrative/costModel';
import { formatLogTime, useRunLog } from '@/narrative/runLog';
import ActionButton from '@/ui/ActionButton';

import Section, { Field } from './Section';

import styles from '../panels/panels.module.css';

import type { BulkCalendarPhase } from '@/narrative/calendarRunState';
import type { RunLogTone } from '@/narrative/runLog';

/** Стадии календарного прогона в порядке исполнения — как их идёт runner. */
const PHASES: { key: BulkCalendarPhase; label: string }[] = [
  { key: 'cast', label: 'cast — персоны и паттерны' },
  { key: 'world_calendar', label: 'worldCalendar — мир и расписание' },
  { key: 'spine', label: 'spine — биты и упаковка' },
  { key: 'schedule', label: 'schedule — присутствие по слотам' },
  { key: 'beat_prose', label: 'beatProse — проза якорных сцен' },
  { key: 'anchor_transitions', label: 'anchorTransitions — нарации переходов' },
  { key: 'event_pool', label: 'eventPool — пул событий' },
  { key: 'prune', label: 'prune — обрезка недостижимого' },
  { key: 'dialogue_units', label: 'dialogueUnits — сцены пула' },
  { key: 'ending_prose', label: 'endingProse — концовки' },
];

/** Сколько строк лога влезает в инспектор, не превращая его в консоль. */
const LOG_TAIL = 10;

const LOG_TONE_CLASS: Record<RunLogTone, string> = {
  info: styles.runLogInfo,
  ok: styles.runLogInfo,
  error: styles.runLogError,
  run: styles.runLogRun,
  pending: styles.runLogRun,
};

export interface RunInspectorProps {
  phase: BulkCalendarPhase;
  progress: { completed: number; total: number };
  error: string | null;
  issues: string[];
  running: boolean;
  hasDraft: boolean;
  /** Прогон ведёт эта вкладка (иначе мы наблюдатель и «Стоп» недоступен). */
  ownsRun: boolean;
  estimate: number;
  onStop: () => void;
  onContinueDraft: () => void;
  onDiscardDraft: () => void;
}

/**
 * Инспектор прогона (макет 7g): фазы со статусами, прогресс, хвост лога,
 * черновик с продолжением. Ошибки ретраятся раннером сами — сюда они
 * приезжают строками лога, вмешательства не ждут.
 */
const RunInspector = ({
  phase,
  progress,
  error,
  issues,
  running,
  hasDraft,
  ownsRun,
  estimate,
  onStop,
  onContinueDraft,
  onDiscardDraft,
}: RunInspectorProps) => {
  const spent = useRunCost(s => s.spent);
  const calls = useRunCost(s => s.calls);
  const logLines = useRunLog(s => s.lines);

  const phaseIndex = PHASES.findIndex(p => p.key === phase);
  const fraction = progress.total === 0 ? 0 : progress.completed / progress.total;
  const tail = logLines.slice(-LOG_TAIL);

  return (
    <>
      <div>
        <div className={styles.kicker}>Инспектор · календарный прогон</div>
        <h2 className={styles.title}>{running ? 'Идёт генерация' : error ? 'Прогон оборван' : 'Прогон не запущен'}</h2>
      </div>

      <Section title="Фазы">
        <div className={styles.runPhases}>
          {PHASES.map((p, index) => {
            const state =
              phase === 'done' || (phaseIndex >= 0 && index < phaseIndex)
                ? 'done'
                : index === phaseIndex
                ? running
                  ? 'active'
                  : error
                  ? 'failed'
                  : 'done'
                : 'pending';
            return (
              <div key={p.key} className={`${styles.runPhase} ${state === 'active' ? styles.runPhaseActive : ''}`}>
                <span
                  className={
                    state === 'active'
                      ? styles.runPhaseIconRun
                      : state === 'failed'
                      ? styles.runPhaseIconFail
                      : state === 'done'
                      ? styles.runPhaseIconDone
                      : styles.runPhaseIconPending
                  }
                >
                  {state === 'active' ? '⟳' : state === 'failed' ? '✗' : state === 'done' ? '✓' : '·'}
                </span>
                <span className={styles.runPhaseLabel}>{p.label}</span>
              </div>
            );
          })}
        </div>
        <div className={styles.runProgressTrack}>
          <div className={styles.runProgressFill} style={{ width: `${Math.round(fraction * 100)}%` }} />
        </div>
        <div className={styles.runProgressMeta}>
          <span>
            {progress.completed} / {progress.total} стадий
          </span>
          <span className={styles.mono}>{`≈ ${formatCost(spent)} из ≈ ${formatCost(estimate)}`}</span>
        </div>
      </Section>

      <Section title="Состояние">
        <Field name="вызовов" mono>
          {String(calls)}
        </Field>
        <Field name="вкладка">{ownsRun ? 'ведёт прогон (web-lock)' : 'наблюдатель'}</Field>
      </Section>

      {tail.length > 0 && (
        <Section title={`Лог · ${LOG_TAIL} последних строк`}>
          <div className={styles.runLog}>
            {tail.map((line, index) => (
              <div key={`${line.t}:${index}`} className={`${styles.runLogLine} ${LOG_TONE_CLASS[line.tone]}`}>
                {formatLogTime(line.t)} {line.text}
              </div>
            ))}
          </div>
        </Section>
      )}

      {error && (
        <Section title="Ошибка">
          <div className={styles.issue}>✗ {error}</div>
          {issues.slice(0, 8).map((issue, index) => (
            <div key={index} className={styles.issueWarning}>
              · {issue}
            </div>
          ))}
        </Section>
      )}

      {hasDraft && !running && (
        <div className={styles.runDraft}>
          <div>
            <div className={styles.runDraftTitle}>Черновик сохранён</div>
            <div className={styles.runDraftNote}>переживает перезагрузку вкладки — прогон дожмётся с места обрыва</div>
          </div>
          <ActionButton label="Продолжить" kind="outline" onClick={onContinueDraft} />
        </div>
      )}

      <div className={styles.actions}>
        <ActionButton
          label="Прервать прогон"
          kind="outline"
          block
          disabled={!running || !ownsRun}
          reason={!running ? 'прогон не идёт' : 'прогон ведёт другая вкладка'}
          onClick={onStop}
        />
        <ActionButton
          label="Сбросить черновик"
          kind="outline"
          block
          disabled={!hasDraft || running}
          reason={running ? 'идёт прогон' : 'черновика нет'}
          onClick={onDiscardDraft}
        />
      </div>
    </>
  );
};

export default RunInspector;
