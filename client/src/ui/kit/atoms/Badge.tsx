import React from 'react';

import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'error';

export interface BadgeProps {
  label: string;
  /** Глиф перед подписью: ✎, ◐, ⇄, ▣. Пусто — глиф не рисуется. */
  glyph?: string;
  tone?: BadgeTone;
  onDark?: boolean;
  /** Кегль подписи, px (8.5–11 в макете). */
  size?: number;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  error: styles.error,
};

/**
 * Порт `design_ref/components/Badge.dc.html` (atoms.json#Badge).
 * Контурный бейдж состояния: ✎ authored, ◐ stale, ⇄ linked, ▣ префаб.
 * Только рамка и текст — заливки нет ни у одного тона.
 */
const Badge = ({ label, glyph, tone = 'neutral', onDark = false, size = 9.5 }: BadgeProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

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
