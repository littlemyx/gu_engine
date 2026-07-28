import React from 'react';

import styles from './Cursor.module.css';

export type CursorTone = 'plain' | 'accent';

export interface CursorProps {
  tone?: CursorTone;
  /** Курсор живёт на тёмном хроме стрима/логов и потому светлеет. */
  onDark?: boolean;
  /** Мигание можно выключить — например, для статичного превью в доке. */
  blink?: boolean;
  /** Кегль глифа в px. */
  size?: number;
}

const TONE_CLASS: Record<CursorTone, string> = {
  plain: styles.plain,
  accent: styles.accent,
};

/**
 * Порт `design_ref/components/Cursor.dc.html` (atoms.json#Cursor).
 * Мигающий ▌ — маркер живого стрима в логах и партитуре: печатает,
 * пока идёт генерация.
 */
const Cursor = ({ tone = 'plain', onDark = false, blink = true, size = 11 }: CursorProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : '', blink ? styles.blink : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }} aria-hidden="true">
      ▌
    </span>
  );
};

export default Cursor;
