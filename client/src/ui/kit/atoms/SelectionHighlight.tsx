import React from 'react';

import styles from './SelectionHighlight.module.css';

export type SelectionHighlightVariant = 'row' | 'cell' | 'outline';

export interface SelectionHighlightProps {
  variant?: SelectionHighlightVariant;
  /** Внутренний отступ содержимого. */
  padding?: number;
  onDark?: boolean;
  children?: React.ReactNode;
}

const VARIANT_CLASS: Record<SelectionHighlightVariant, string> = {
  row: styles.row,
  cell: styles.cell,
  outline: styles.outline,
};

/**
 * Порт `design_ref/components/SelectionHighlight.dc.html` (atoms.json#SelectionHighlight).
 * Заливка выбранной строки или ячейки таблицы: акцентный тинт плюс, у `row`,
 * полоса-индикатор слева; `outline` — только рамка в 2px, без заливки.
 */
const SelectionHighlight = ({ variant = 'row', padding = 8, onDark = false, children }: SelectionHighlightProps) => {
  const className = [styles.root, VARIANT_CLASS[variant], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={className} style={{ padding: `${padding}px` }}>
      {children}
    </div>
  );
};

export default SelectionHighlight;
