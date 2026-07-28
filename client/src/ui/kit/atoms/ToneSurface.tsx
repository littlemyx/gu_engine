import React from 'react';

import styles from './ToneSurface.module.css';

export type ToneSurfaceTone = 'accent' | 'whiteOnDark' | 'error' | 'warn' | 'darkAccent';

export interface ToneSurfaceProps {
  children?: React.ReactNode;
  tone?: ToneSurfaceTone;
  /** Осмыслен только у `whiteOnDark`: доля белого в подложке. */
  whiteAlpha?: number;
  padding?: number;
}

const TONE_CLASS: Record<ToneSurfaceTone, string> = {
  accent: styles.accent,
  whiteOnDark: styles.whiteOnDark,
  error: styles.error,
  warn: styles.warn,
  darkAccent: styles.darkAccent,
};

/**
 * Порт `design_ref/components/ToneSurface.dc.html` (atoms.json#ToneSurface).
 * Тонированная заливка-подложка под произвольный контент: accent-100,
 * полупрозрачная белая на тёмном хроме, error/warn сигналы, тёмная accent-900.
 */
const ToneSurface = ({ children, tone = 'accent', whiteAlpha = 0.09, padding = 10 }: ToneSurfaceProps) => {
  const className = [styles.root, TONE_CLASS[tone]].filter(Boolean).join(' ');
  const style = {
    padding: `${padding}px`,
    ...(tone === 'whiteOnDark' ? { '--tone-alpha': `${Math.round(whiteAlpha * 100)}%` } : {}),
  } as React.CSSProperties;

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
};

export default ToneSurface;
