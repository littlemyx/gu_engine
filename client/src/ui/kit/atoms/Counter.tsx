import React from 'react';

import styles from './Counter.module.css';

export type CounterTone = 'neutral' | 'accent' | 'warn' | 'error';

export interface CounterProps {
  /** Текст счётчика: `4/9`, `×3`, `21 слот` — форма произвольная. */
  value: string;
  tone?: CounterTone;
  onDark?: boolean;
  /** Кегль цифр, px (9–13 в макете). */
  size?: number;
}

const TONE_CLASS: Record<CounterTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  warn: styles.warn,
  error: styles.error,
};

/**
 * Порт `design_ref/components/Counter.dc.html` (atoms.json#Counter).
 * Моноширинный счётчик слотов/итераций. Тон «нейтральный» — служебный счёт,
 * «статусный» (accent/warn/error) подсвечивает предел или ошибку, форма не меняется.
 */
const Counter = ({ value, tone = 'neutral', onDark = false, size = 10 }: CounterProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {value}
    </span>
  );
};

export default Counter;
