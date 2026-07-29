import React from 'react';

import styles from './Counter.module.css';

export type CounterTone = 'neutral' | 'accent' | 'warn' | 'error';

/** Гарнитура цифр: `mono` (по умолчанию, как в макете) или текстовая `body`. */
export type CounterFont = 'mono' | 'body';

export interface CounterProps {
  /** Текст счётчика: `4/9`, `×3`, `21 слот` — форма произвольная. */
  value: string;
  tone?: CounterTone;
  onDark?: boolean;
  /** Кегль цифр, px (9–13 в макете). */
  size?: number;
  /**
   * Сплошной `--gu-ink` вместо приглушённого `ink-60` на тёмном хроме —
   * для счётчиков статистики, которым нужен полный контраст, а не служебный тон.
   * Не действует на светлом — там тона и так сплошные.
   */
  strong?: boolean;
  /** Гарнитура: `mono` (по умолчанию) или `body`. */
  font?: CounterFont;
}

const TONE_CLASS: Record<CounterTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  warn: styles.warn,
  error: styles.error,
};

const FONT_CLASS: Record<CounterFont, string> = {
  mono: '',
  body: styles.body,
};

/**
 * Порт `design_ref/components/Counter.dc.html` (atoms.json#Counter).
 * Моноширинный счётчик слотов/итераций. Тон «нейтральный» — служебный счёт,
 * «статусный» (accent/warn/error) подсвечивает предел или ошибку, форма не меняется.
 * `strong` и `font` — расширения по запросу молекул (см. CHANGELOG задачи атома).
 */
const Counter = ({
  value,
  tone = 'neutral',
  onDark = false,
  size = 10,
  strong = false,
  font = 'mono',
}: CounterProps) => {
  const className = [
    styles.root,
    TONE_CLASS[tone],
    onDark ? styles.onDark : '',
    strong ? styles.strong : '',
    FONT_CLASS[font],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {value}
    </span>
  );
};

export default Counter;
