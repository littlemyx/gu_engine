import React from 'react';

import styles from './BigDigit.module.css';

export type BigDigitTone = 'normal' | 'accent' | 'quiet';

export interface BigDigitProps {
  /** Само число/итог, строкой — так проще нести ведущие нули и диапазоны. */
  value: string;
  /** Подпись единицы рядом с цифрой: «битов», «сцен». Без неё не рисуется. */
  unit?: string;
  tone?: BigDigitTone;
  onDark?: boolean;
  /** Кегль цифры, px (24–72 в макете); подпись единицы масштабируется от него. */
  size?: number;
}

const TONE_CLASS: Record<BigDigitTone, string> = {
  normal: styles.normal,
  accent: styles.accent,
  quiet: styles.quiet,
};

/**
 * Порт `design_ref/components/BigDigit.dc.html` (atoms.json#BigDigit).
 * Крупная цифра итога/KPI: тон несёт смысл (обычный счёт / акцентный вывод /
 * приглушённая деталь), а единица измерения печатается мельче рядом.
 */
const BigDigit = ({ value, unit, tone = 'normal', onDark = false, size = 34 }: BigDigitProps) => {
  const digitClassName = [styles.digit, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const unitClassName = [styles.unit, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const unitSize = Math.max(10, Math.round(size * 0.32));

  return (
    <span className={styles.root}>
      <span className={digitClassName} style={{ fontSize: `${size}px` }}>
        {value}
      </span>
      {unit && (
        <span className={unitClassName} style={{ fontSize: `${unitSize}px` }}>
          {unit}
        </span>
      )}
    </span>
  );
};

export default BigDigit;
