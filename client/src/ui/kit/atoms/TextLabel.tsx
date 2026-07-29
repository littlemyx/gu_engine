import React from 'react';

import styles from './TextLabel.module.css';

/**
 * Смысловой тон подписи. `normal` — прежнее поведение (одна пара цветов на
 * `onDark`); остальные красят текст по состоянию, которое обозначает
 * молекула (имя трека, статус, приглушённая мета), независимо от `bold`.
 */
export type TextLabelTone = 'normal' | 'muted' | 'accent' | 'error' | 'warn';

export interface TextLabelProps {
  text: string;
  /** Метка стоит на тёмном хроме и потому светлеет. */
  onDark?: boolean;
  bold?: boolean;
  /** px, 9–14, шаг 0.5. */
  size?: number;
  /** Тон цвета. По умолчанию `normal` — не меняет прежний вид. */
  tone?: TextLabelTone;
}

const TONE_CLASS: Record<TextLabelTone, string> = {
  normal: '',
  muted: styles.muted,
  accent: styles.accent,
  error: styles.error,
  warn: styles.warn,
};

/**
 * Порт `design_ref/components/TextLabel.dc.html` (atoms.json#TextLabel).
 * Базовый текст интерфейса: подписи, значения полей, служебные строки —
 * везде, где не нужен готовый заголовок или моноширинный счётчик. Тон
 * (`normal` / `muted` / `accent` / `error` / `warn`) и `bold` независимы —
 * жирная акцентная или сигнальная подпись на светлом красится так же, как
 * обычная.
 */
const TextLabel = ({ text, onDark = false, bold = false, size = 11.5, tone = 'normal' }: TextLabelProps) => {
  const className = [styles.root, onDark ? styles.onDark : '', bold ? styles.bold : '', TONE_CLASS[tone]]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  );
};

export default TextLabel;
