import React from 'react';

import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'error';

/**
 * `outline` — контурный бокс (умолчание, поведение не менялось).
 * `plain` — без рамки и паддинга: голый цветной текст статуса (нужен BeatCard).
 */
export type BadgeVariant = 'outline' | 'plain';

export interface BadgeProps {
  label: string;
  /** Глиф перед подписью: ✎, ◐, ⇄, ▣. Пусто — глиф не рисуется. */
  glyph?: string;
  tone?: BadgeTone;
  onDark?: boolean;
  /** Кегль подписи, px (8.5–11 в макете). */
  size?: number;
  variant?: BadgeVariant;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  error: styles.error,
};

/**
 * Порт `design_ref/components/Badge.dc.html` (atoms.json#Badge).
 * Контурный бейдж состояния: ✎ authored, ◐ stale, ⇄ linked, ▣ префаб.
 * Только рамка и текст — заливки нет ни у одного тона. Вариант `plain` снимает
 * рамку и паддинг для мест, где нужен просто цветной текст статуса.
 */
const Badge = ({ label, glyph, tone = 'neutral', onDark = false, size = 9.5, variant = 'outline' }: BadgeProps) => {
  const className = [
    styles.root,
    TONE_CLASS[tone],
    onDark ? styles.onDark : '',
    variant === 'plain' ? styles.plain : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {glyph && (
        <span aria-hidden="true" className={styles.glyph}>
          {glyph}
        </span>
      )}
      <span>{label}</span>
    </span>
  );
};

export default Badge;
