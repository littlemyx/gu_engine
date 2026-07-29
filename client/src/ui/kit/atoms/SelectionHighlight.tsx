import React from 'react';

import styles from './SelectionHighlight.module.css';

export type SelectionHighlightVariant = 'row' | 'cell' | 'outline' | 'ring';

/** Цвет внешнего кольца у варианта `ring`. */
export type SelectionHighlightOutlineTone = 'accent' | 'accent-900';

export interface SelectionHighlightProps {
  variant?: SelectionHighlightVariant;
  /** Внутренний отступ содержимого. */
  padding?: number;
  onDark?: boolean;
  /** Отступ внешнего кольца от границ содержимого у варианта `ring`, px. Игнорируется остальными вариантами. */
  outlineOffset?: number;
  /** Цвет внешнего кольца у варианта `ring`. Игнорируется остальными вариантами. */
  outlineTone?: SelectionHighlightOutlineTone;
  children?: React.ReactNode;
}

const VARIANT_CLASS: Record<SelectionHighlightVariant, string> = {
  row: styles.row,
  cell: styles.cell,
  outline: styles.outline,
  ring: styles.ring,
};

const OUTLINE_TONE_CLASS: Record<SelectionHighlightOutlineTone, string> = {
  accent: styles.toneAccent,
  'accent-900': styles.toneAccent900,
};

/**
 * Порт `design_ref/components/SelectionHighlight.dc.html` (atoms.json#SelectionHighlight).
 * Заливка выбранной строки или ячейки таблицы: акцентный тинт плюс, у `row`,
 * полоса-индикатор слева; `outline` — рамка в 2px внутрь, без заливки;
 * `ring` — внешнее кольцо с настраиваемым отступом (`outlineOffset`) и цветом
 * (`outlineTone`), как в макете, где кольцо рисуется в `--color-accent-900`.
 */
const SelectionHighlight = ({
  variant = 'row',
  padding = 8,
  onDark = false,
  outlineOffset = 2,
  outlineTone = 'accent-900',
  children,
}: SelectionHighlightProps) => {
  const className = [
    styles.root,
    VARIANT_CLASS[variant],
    variant === 'ring' ? OUTLINE_TONE_CLASS[outlineTone] : '',
    onDark ? styles.onDark : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = { padding: `${padding}px` };
  if (variant === 'ring') {
    style.outlineOffset = `${outlineOffset}px`;
  }

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
};

export default SelectionHighlight;
