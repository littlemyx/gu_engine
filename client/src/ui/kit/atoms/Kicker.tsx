import React from 'react';

import styles from './Kicker.module.css';

export type KickerTone = 'neutral' | 'accent' | 'error';

export interface KickerProps {
  text: string;
  tone?: KickerTone;
  /** Кикер стоит на тёмном хроме и потому меняет тона. */
  onDark?: boolean;
  /** px, 8–9.5, шаг 0.5. */
  size?: number;
}

const TONE_CLASS: Record<KickerTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  error: styles.error,
};

/**
 * Порт `design_ref/components/Kicker.dc.html` (atoms.json#Kicker).
 * Надзаголовок: капслок, разрядка, 8–9.5px — лейбл поля или код секции
 * перед заголовком/значением.
 */
const Kicker = ({ text, tone = 'neutral', onDark = false, size = 9 }: KickerProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  );
};

export default Kicker;
