import React from 'react';

import styles from './IndentSpacer.module.css';

export interface IndentSpacerProps {
  /** Ступень вложенности строки дерева/списка. */
  level?: number;
  /** Ширина одной ступени, px. */
  step?: number;
}

/**
 * Порт `design_ref/components/IndentSpacer.dc.html` (atoms.json#IndentSpacer).
 * Невидимый блок шириной `level * step` — резервирует отступ перед иконкой и
 * текстом строки дерева (см. молекулы каскада вида `HierarchyRow`).
 */
const IndentSpacer = ({ level = 2, step = 14 }: IndentSpacerProps) => {
  const width = Math.max(0, level * step);

  return <span aria-hidden="true" className={styles.root} style={{ width }} />;
};

export default IndentSpacer;
