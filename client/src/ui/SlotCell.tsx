import React from 'react';

import styles from './SlotCell.module.css';

export type SlotCellState = 'loc' | 'offscreen' | 'done' | 'open' | 'locked' | 'failed' | 'empty';

export interface SlotCellProps {
  text: string;
  state?: SlotCellState;
  /** Подсказка в title; без неё показывается сам текст. */
  tip?: string;
  selected?: boolean;
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

/**
 * Ячейка партитуры на пересечении слота и персонажа. Размер всегда 33×24:
 * состояния кодируются заливкой и рамкой, детали уходят в инспектор.
 */
const SlotCell = ({ text, state = 'loc', tip, selected = false, onClick }: SlotCellProps) => {
  const className = [styles.root, STATE_CLASS[state] ?? STATE_CLASS.loc, selected ? styles.selected : '']
    .filter(Boolean)
    .join(' ');

  if (!onClick) {
    return (
      <span className={className} title={tip ?? text}>
        {text}
      </span>
    );
  }

  return (
    <button type="button" className={className} title={tip ?? text} onClick={onClick}>
      {text}
    </button>
  );
};

export default SlotCell;
