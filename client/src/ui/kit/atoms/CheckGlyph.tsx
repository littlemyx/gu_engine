import React from 'react';

import styles from './CheckGlyph.module.css';

export type CheckGlyphTone = 'ok' | 'muted';

export interface CheckGlyphProps {
  tone?: CheckGlyphTone;
  onDark?: boolean;
  /** Кегль глифа в пикселях. */
  size?: number;
}

const TONE_CLASS: Record<CheckGlyphTone, string> = {
  ok: styles.ok,
  muted: styles.muted,
};

/**
 * Порт `design_ref/components/CheckGlyph.dc.html` (atoms.json#CheckGlyph).
 * Галочка «✓» для списков готовности и чеклистов: `ok` — пункт выполнен,
 * `muted` — тот же глиф приглушённым тоном там, где акцент неуместен.
 */
const CheckGlyph = ({ tone = 'ok', onDark = false, size = 11 }: CheckGlyphProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span aria-hidden="true" className={className} style={{ fontSize: `${size}px` }}>
      ✓
    </span>
  );
};

export default CheckGlyph;
