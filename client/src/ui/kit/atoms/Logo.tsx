import React from 'react';

import styles from './Logo.module.css';

export type LogoTone = 'muted' | 'contrast';

export interface LogoProps {
  text: string;
  tone?: LogoTone;
  onDark?: boolean;
  /** Кегль в px, как в макете (диапазон 10–24). */
  size?: number;
}

const TONE_CLASS: Record<LogoTone, string> = {
  muted: styles.muted,
  contrast: styles.contrast,
};

/**
 * Порт `design_ref/components/Logo.dc.html` (atoms.json#Logo).
 * Условенсированная капслочная надпись — фирменный знак «GU Engine» в шапках
 * и шелле. Приглушённый тон уходит в чертёжный акцент, контрастный — в чернила.
 */
const Logo = ({ text, tone = 'muted', onDark = false, size = 12 }: LogoProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  );
};

export default Logo;
