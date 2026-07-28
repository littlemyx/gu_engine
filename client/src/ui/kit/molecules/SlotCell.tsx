import React from 'react';

import styles from './SlotCell.module.css';

/**
 * Порт `design_ref/components/SlotCell.dc.html` (molecules.json#p023).
 * Ячейка партитуры на пересечении слота и персонажа. Размер всегда
 * 33×24: семь состояний генерации/присутствия кодируются заливкой, рамкой
 * и весом текста, детали уходят в инспектор.
 */
export type SlotCellState = 'loc' | 'offscreen' | 'done' | 'open' | 'locked' | 'failed' | 'empty';

export interface SlotCellProps {
  text: string;
  state?: SlotCellState;
  /** Подсказка в title; без неё показывается сам текст. */
  tip?: string;
  onClick?: () => void;
}

const STATE_CLASS: Record<SlotCellState, string> = {
  loc: styles.loc,
  offscreen: styles.offscreen,
  done: styles.done,
  open: styles.open,
  locked: styles.locked,
  failed: styles.failed,
  empty: styles.empty,
};

const SlotCell = ({ text, state = 'loc', tip, onClick }: SlotCellProps) => {
  const className = [styles.root, STATE_CLASS[state] ?? STATE_CLASS.loc].filter(Boolean).join(' ');
  const title = tip ?? text;

  if (!onClick) {
    return (
      <span className={className} title={title}>
        {text}
      </span>
    );
  }

  return (
    <button type="button" className={className} title={title} onClick={onClick}>
      {text}
    </button>
  );
};

export default SlotCell;
