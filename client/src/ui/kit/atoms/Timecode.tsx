import React from 'react';

import styles from './Timecode.module.css';

export interface TimecodeProps {
  /** Строка таймкода, например `0:34` или `1:48`. */
  value?: string;
  /** Таймкод стоит на тёмном хроме и потому светлеет. */
  onDark?: boolean;
  /** Приглушённый тон — вторичный таймкод рядом с основным. */
  muted?: boolean;
  /** Кегль в px (мокап допускает 9–13). */
  size?: number;
}

/**
 * Порт `design_ref/components/Timecode.dc.html` (atoms.json#Timecode).
 * Моноширинная метка времени (`0:34 / 1:48`) для плашек монтажа и партитуры.
 */
const Timecode = ({ value = '0:34', onDark = false, muted = false, size = 10 }: TimecodeProps) => {
  const className = [styles.root, onDark ? styles.onDark : '', muted ? styles.muted : ''].filter(Boolean).join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {value}
    </span>
  );
};

export default Timecode;
