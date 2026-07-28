import React from 'react';

import styles from './Glyph.module.css';

export type GlyphTone = 'neutral' | 'accent' | 'info' | 'error' | 'warn' | 'muted';

export interface GlyphProps {
  /** Символ-иконка текстом: ◈ ● ▸ ♪ ⠿ ⇉ ◐ (для настоящих иконок — Lucide 1.5). */
  glyph: string;
  tone?: GlyphTone;
  /** Кегль в px, диапазон макета 9–24. */
  size?: number;
  onDark?: boolean;
}

const TONE_CLASS: Record<GlyphTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  info: styles.info,
  error: styles.error,
  warn: styles.warn,
  muted: styles.muted,
};

/**
 * Порт `design_ref/components/Glyph.dc.html` (atoms.json#Glyph).
 * Декоративный символ-иконка: чисто визуальный акцент, поэтому всегда
 * `aria-hidden` и никогда не кликабелен. Тон и контекст (свет/тьма) вместе
 * решают, из какой палитры берётся цвет.
 */
const Glyph = ({ glyph, tone = 'neutral', size = 12, onDark = false }: GlyphProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span aria-hidden="true" className={className} style={{ fontSize: `${size}px` }}>
      {glyph}
    </span>
  );
};

export default Glyph;
