import React from 'react';

import styles from './ReadinessRow.module.css';

export type ReadinessRowState = 'done' | 'problem' | 'waiting';

export interface ReadinessRowProps {
  /** Логлайн/тон или любая другая строка пункта чек-листа готовности. */
  text: string;
  state?: ReadinessRowState;
}

const GLYPH: Record<ReadinessRowState, string> = {
  done: '✓',
  problem: '○',
  waiting: '○',
};

const STATE_CLASS: Record<ReadinessRowState, string> = {
  done: styles.done,
  problem: styles.problem,
  waiting: styles.waiting,
};

/**
 * Порт `design_ref/components/ReadinessRow.dc.html` (molecules.json#k022,
 * «строки готовности зоны»).
 * Строка чек-листа готовности зоны: глиф + подпись, три состояния —
 * готово/проблема/ожидает, каждое со своим оттенком чернил на тёмном хроме.
 * Атомы StatusGlyph и TextLabel не подошли: их цвет завязан на собственный
 * сигнальный словарь (status/onDark) без способа передать снаружи именно эту
 * ink-тройку токенов, поэтому глиф и подпись собраны локально теми же
 * токенами, что использует дизайн.
 */
const ReadinessRow = ({ text, state = 'done' }: ReadinessRowProps) => {
  const stateClass = STATE_CLASS[state];

  return (
    <div className={styles.root}>
      <span className={`${styles.glyph} ${stateClass}`} aria-hidden="true">
        {GLYPH[state]}
      </span>
      <span className={`${styles.text} ${stateClass}`}>{text}</span>
    </div>
  );
};

export default ReadinessRow;
