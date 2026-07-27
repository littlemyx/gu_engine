import React from 'react';

import ActionButton from '@/ui/ActionButton';

import styles from './viewport.module.css';

import type { BracketCell, RelationsModel } from '../derive/relationsModel';

const LAYER_CLASS = {
  offscreen: 'relCellOff',
  present: 'relCellPresent',
  meeting: 'relCellMeeting',
  anchor: 'relCellAnchor',
} as const;

const BRACKET_HEADS: Array<{ key: 'warm' | 'neutral' | 'cold'; label: string }> = [
  { key: 'warm', label: 'warm · тепло' },
  { key: 'neutral', label: 'neutral' },
  { key: 'cold', label: 'cold · холод' },
];

const coverageText = (cell: BracketCell): string => {
  if (cell.level === 'bad') return '✗ 0 — ветка не написана';
  const units = cell.count === 1 ? '1 юнит' : cell.count < 5 ? `${cell.count} юнита` : `${cell.count} юнитов`;
  return `${cell.level === 'warn' ? '⚠' : '✓'} ${units}`;
};

export interface RelationsViewProps {
  model: RelationsModel;
  /** Догенерация юнитов под пустые брекеты: seedIssues.eventPool → прогон. */
  onSeedUnits: () => void;
  seedDisabledReason?: string;
}

/**
 * «Отношения · присутствие и покрытие» (макет 7e): недельная сетка присутствия
 * по слотам (в локации / встреча / якорный бит) и покрытие брекетов
 * warm/neutral/cold диалоговыми юнитами с CTA на догенерацию.
 */
const RelationsView = ({ model, onSeedUnits, seedDisabledReason }: RelationsViewProps) => (
  <div className={styles.relationsRoot}>
    <section className={styles.audioPanel}>
      <header className={styles.audioPanelHead}>
        <span>Присутствие по слотам</span>
        <span className={styles.audioPanelTag}>schedule · встречи · якоря</span>
      </header>

      <div className={styles.relGrid} style={{ gridTemplateColumns: `70px 1fr` }}>
        <span />
        <div className={styles.relDays}>
          {model.days.map(day => (
            <span key={day} className={styles.relDay}>
              {day}
            </span>
          ))}
        </div>
        {model.rows.map(row => (
          <React.Fragment key={row.liId}>
            <span className={styles.relName}>{row.name}</span>
            <div className={styles.relTrack} style={{ gridTemplateColumns: `repeat(${model.slotCount}, 1fr)` }}>
              {row.cells.map((layer, slot) => (
                <span
                  key={slot}
                  className={`${styles.relCell} ${styles[LAYER_CLASS[layer]]}`}
                  title={`слот ${slot + 1}`}
                />
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className={styles.relLegend}>
        <span className={`${styles.relSwatch} ${styles.relCellPresent}`} /> в локации по расписанию
        <span className={`${styles.relSwatch} ${styles.relCellMeeting}`} /> встреча — диалоговый юнит
        <span className={`${styles.relSwatch} ${styles.relCellAnchor}`} /> якорный бит
        <span className={styles.relSlotNote}>{model.slotNote}</span>
      </div>
    </section>

    <section className={styles.audioPanel}>
      <header className={styles.audioPanelHead}>
        <span>Покрытие брекетов диалоговыми юнитами</span>
        <span className={styles.audioPanelTag}>пороги a₀ ± 0.15</span>
      </header>

      <div className={styles.relCoverage}>
        <span />
        {BRACKET_HEADS.map(head => (
          <span key={head.key} className={styles.audioVariationHead}>
            {head.label}
          </span>
        ))}
        {model.coverage.map(row => (
          <React.Fragment key={row.liId}>
            <span className={styles.relName}>{row.name}</span>
            {BRACKET_HEADS.map(head => {
              const cell = row[head.key];
              return (
                <span
                  key={head.key}
                  className={`${styles.relCoverageCell} ${
                    cell.level === 'bad'
                      ? styles.relCoverageBad
                      : cell.level === 'warn'
                      ? styles.relCoverageWarn
                      : styles.relCoverageOk
                  }`}
                >
                  {coverageText(cell)}
                </span>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {model.problems.length > 0 && (
        <div className={styles.relProblems}>
          {model.problems.map(problem => (
            <div key={`${problem.liId}:${problem.bracket}`} className={styles.relProblemLine}>
              {problem.message}
            </div>
          ))}
          <ActionButton
            label="Догенерировать юниты"
            cost="фидбек-прогон пула событий"
            kind="outline"
            disabled={Boolean(seedDisabledReason)}
            reason={seedDisabledReason}
            onClick={onSeedUnits}
          />
        </div>
      )}
    </section>
  </div>
);

export default RelationsView;
