import React from 'react';

import styles from './Letterform.module.css';

export type LetterformVariant = 'outline' | 'filled';

export interface LetterformProps {
  /** Один символ или короткий код: A, Б4, С3. */
  letter?: string;
  variant?: LetterformVariant;
  selected?: boolean;
  /** Сторона квадрата в px, 16–36. */
  size?: number;
  onDark?: boolean;
  onClick?: () => void;
}

const VARIANT_CLASS: Record<LetterformVariant, string> = {
  outline: styles.outline,
  filled: styles.filled,
};

/**
 * Порт `design_ref/components/Letterform.dc.html` (atoms.json#Letterform).
 * Одиночная литера в квадрате — жетон персонажа или слота на партитуре
 * (A/B, Б4, С3). Заливка не реагирует на выделение, контур — реагирует.
 */
const Letterform = ({
  letter = 'A',
  variant = 'outline',
  selected = false,
  size = 22,
  onDark = false,
  onClick,
}: LetterformProps) => {
  const className = [styles.root, VARIANT_CLASS[variant], selected ? styles.selected : '', onDark ? styles.onDark : '']
    .filter(Boolean)
    .join(' ');

  const style = { '--letterform-size': `${size}px` } as React.CSSProperties;

  if (!onClick) {
    return (
      <span className={className} style={style}>
        {letter}
      </span>
    );
  }

  return (
    <button type="button" className={className} style={style} onClick={onClick}>
      {letter}
    </button>
  );
};

export default Letterform;
