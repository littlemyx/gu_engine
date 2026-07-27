import React from 'react';

import styles from './HierarchyRow.module.css';

export type HierarchyRowState = 'normal' | 'selected' | 'failed' | 'running' | 'dim';

export interface HierarchyRowProps {
  label: string;
  meta?: string;
  icon?: string;
  /** Глубина 0–3; отступ = 8 + 13 × depth. */
  depth?: number;
  state?: HierarchyRowState;
  /** Строка выделена и одновременно сигналит о сбое/генерации. */
  selected?: boolean;
  onClick?: () => void;
}

const STATE_CLASS: Record<HierarchyRowState, string> = {
  normal: '',
  selected: styles.selected,
  failed: styles.failed,
  running: styles.running,
  dim: styles.dim,
};

/** Строка дерева «Иерархия истории»: история → бит → персонаж → группа → юнит. */
const HierarchyRow = ({
  label,
  meta = '',
  icon = '·',
  depth = 0,
  state = 'normal',
  selected = false,
  onClick,
}: HierarchyRowProps) => {
  const className = [styles.root, STATE_CLASS[state] ?? '', selected && state !== 'selected' ? styles.selected : '']
    .filter(Boolean)
    .join(' ');

  const style = { paddingLeft: `${8 + 13 * depth}px` };

  const body = (
    <>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label} title={label}>
        {label}
      </span>
      <span className={styles.meta}>{meta}</span>
    </>
  );

  if (!onClick) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }

  return (
    <button type="button" className={className} style={style} onClick={onClick}>
      {body}
    </button>
  );
};

export default HierarchyRow;
