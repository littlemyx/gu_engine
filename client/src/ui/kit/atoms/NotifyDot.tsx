import React from 'react';

import styles from './NotifyDot.module.css';

export type NotifyDotTone = 'yellow' | 'accent' | 'error';

export interface NotifyDotProps {
  tone?: NotifyDotTone;
  /** Диаметр точки в пикселях. */
  size?: number;
  onDark?: boolean;
}

const TONE_CLASS: Record<NotifyDotTone, string> = {
  yellow: styles.yellow,
  accent: styles.accent,
  error: styles.error,
};

/**
 * Порт `design_ref/components/NotifyDot.dc.html` (atoms.json#NotifyDot).
 * Точка-нотификатор: непросмотренное в панели или табе. Голая точка без
 * подписи — позиционирование поверх ярлыка остаётся на вызывающей стороне.
 */
const NotifyDot = ({ tone = 'yellow', size = 6, onDark = false }: NotifyDotProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return <span className={className} style={{ width: size, height: size }} aria-hidden="true" />;
};

export default NotifyDot;
