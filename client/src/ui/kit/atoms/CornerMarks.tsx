import React from 'react';

import styles from './CornerMarks.module.css';

export type CornerMarksTone = 'plain' | 'accent';

export interface CornerMarksProps {
  tone?: CornerMarksTone;
  /** Реперы стоят на тёмном хроме и потому светлеют. */
  onDark?: boolean;
  children?: React.ReactNode;
}

const TONE_CLASS: Record<CornerMarksTone, string> = {
  plain: styles.plain,
  accent: styles.accent,
};

/**
 * Порт `design_ref/components/CornerMarks.dc.html` (atoms.json#CornerMarks).
 * Четыре крестика-репера по углам — базовый приём Industry: ими размечен
 * любой «чертёжный объект». Рамку не рисует: её задаёт то, что оборачивает.
 */
const CornerMarks = ({ tone = 'plain', onDark = false, children }: CornerMarksProps) => {
  const rootClass = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {children}
      <i className={`${styles.corner} ${styles.tl}`} aria-hidden="true" />
      <i className={`${styles.corner} ${styles.tr}`} aria-hidden="true" />
      <i className={`${styles.corner} ${styles.bl}`} aria-hidden="true" />
      <i className={`${styles.corner} ${styles.br}`} aria-hidden="true" />
    </div>
  );
};

export default CornerMarks;
