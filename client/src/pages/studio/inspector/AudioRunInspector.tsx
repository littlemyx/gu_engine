import React from 'react';

import ActionButton from '@/ui/ActionButton';

import Section from './Section';

import styles from '../panels/panels.module.css';

import type { AudioModel } from '../derive/audioModel';
import type { AudioBulkStatus } from '@/narrative/useBulkAudioGeneration';

const PHASES = [
  { key: 'base', label: 'base — подложка' },
  { key: 'beds', label: 'beds — эмбиенты и диегетика' },
  { key: 'variations', label: 'variations — тепло/холод LI' },
  { key: 'sfx', label: 'sfx — набор поз' },
] as const;

export interface AudioRunInspectorProps {
  model: AudioModel;
  status: AudioBulkStatus;
  /** Стиль подложки: живёт в шелле, чтобы вкладка «Аудио» показывала его же. */
  baseStyle: string;
  onBaseStyleChange: (style: string) => void;
  disabledReason?: string;
  onStart: (baseStyle: string) => void;
  onCancel: () => void;
  /** Полная перегенерация: сброс банка (и выбранных вариантов A/B) + старт. */
  onForceAll: (baseStyle: string) => void;
}

/**
 * Инспектор запуска аудио (макет 7a): редактируемый стиль подложки, фазы
 * конвейера со счётчиками, прогресс и стоимость; на полном кэше обычный
 * старт — no-op, остаётся только force с предупреждением.
 */
const AudioRunInspector = ({
  model,
  status,
  baseStyle,
  onBaseStyleChange,
  disabledReason,
  onStart,
  onCancel,
  onForceAll,
}: AudioRunInspectorProps) => {
  const running = status.state === 'running';
  const fullCache = model.total > 0 && model.done >= model.total;
  const remaining = Math.max(0, model.total - model.done);
  const estimate = `≈ $${(remaining * 0.02).toFixed(2)}`;
  const fraction = model.total === 0 ? 0 : model.done / model.total;
  const activePhase = running ? status.phase : null;
  const activeIndex = PHASES.findIndex(p => p.key === activePhase);

  return (
    <>
      <div>
        <div className={styles.kicker}>Инспектор · запуск аудио</div>
        <h2 className={styles.title}>
          {running ? 'Пишется банк' : fullCache ? 'Банк на полном кэше' : 'Аудио-конвейер'}
        </h2>
      </div>

      <Section title="Стиль подложки · редактируемый">
        <textarea
          className={styles.audioStyleInput}
          value={baseStyle}
          onChange={e => onBaseStyleChange(e.target.value)}
          rows={3}
          spellCheck={false}
          disabled={running}
        />
        <div className={styles.runProgressMeta}>
          <span>{'шаблоны настроений подставляют {timbre} сами — MOOD_STYLE_TEMPLATES'}</span>
        </div>
      </Section>

      <Section title="Фазы прогона">
        <div className={styles.runPhases}>
          {PHASES.map((p, index) => {
            const counts = model.phases[p.key];
            const state =
              activeIndex === index
                ? 'active'
                : counts.total > 0 && counts.done >= counts.total
                ? 'done'
                : activeIndex >= 0 && index < activeIndex
                ? 'done'
                : 'pending';
            return (
              <div key={p.key} className={`${styles.runPhase} ${state === 'active' ? styles.runPhaseActive : ''}`}>
                <span
                  className={
                    state === 'active'
                      ? styles.runPhaseIconRun
                      : state === 'done'
                      ? styles.runPhaseIconDone
                      : styles.runPhaseIconPending
                  }
                >
                  {state === 'active' ? '⟳' : state === 'done' ? '✓' : '·'}
                </span>
                <span className={styles.runPhaseLabel}>{p.label}</span>
                <span className={`${styles.mono} ${styles.runPhaseCount}`}>
                  {counts.done}/{counts.total}
                </span>
              </div>
            );
          })}
        </div>
        <div className={styles.runProgressTrack}>
          <div className={styles.runProgressFill} style={{ width: `${Math.round(fraction * 100)}%` }} />
        </div>
        <div className={styles.runProgressMeta}>
          <span>
            {model.done} / {model.total} треков
          </span>
          <span className={styles.mono}>{estimate} Suno</span>
        </div>
        {running && status.failures.length > 0 && <div className={styles.issue}>✗ сбоев: {status.failures.length}</div>}
      </Section>

      {running ? (
        <div className={styles.actions}>
          <ActionButton
            label={status.cancelled ? 'Отменяется…' : 'Отменить прогон'}
            kind="outline"
            block
            disabled={status.cancelled}
            reason="отмена уже запрошена"
            onClick={onCancel}
          />
          <div className={styles.runDraftNote}>
            отмена дорезает текущий трек и останавливает очередь; готовое остаётся в кэше
          </div>
        </div>
      ) : fullCache ? (
        <div className={styles.actions}>
          <div className={styles.kicker}>
            На полном кэше · {model.done}/{model.total}
          </div>
          <ActionButton
            label="Перегенерировать всё"
            cost="≈ $0.02 за трек"
            kind="outline"
            block
            disabled={Boolean(disabledReason)}
            reason={disabledReason}
            onClick={() => onForceAll(baseStyle)}
          />
          <div className={styles.audioForceWarning}>⚠ сбросит выбранные варианты A/B по всем трекам</div>
        </div>
      ) : (
        <div className={styles.actions}>
          <ActionButton
            label="Сгенерировать аудио"
            cost={estimate}
            block
            disabled={Boolean(disabledReason)}
            reason={disabledReason}
            onClick={() => onStart(baseStyle)}
          />
          <div className={styles.runDraftNote}>
            прогон resumable: готовые треки пропускаются, Suno-задачи идут минуты каждая
          </div>
        </div>
      )}

      {status.state === 'done' && status.failures.length > 0 && (
        <Section title="Сбои прошлого прогона">
          {status.failures.slice(0, 6).map(f => (
            <div key={f.key} className={styles.issue}>
              ✗ {f.key}: {f.error}
            </div>
          ))}
        </Section>
      )}
    </>
  );
};

export default AudioRunInspector;
