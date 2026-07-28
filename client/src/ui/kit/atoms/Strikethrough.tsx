import React from 'react';

import styles from './Strikethrough.module.css';

export type StrikethroughTone = 'accent' | 'plain';

export interface StrikethroughProps {
  /** Прежнее значение — всегда показано зачёркнутым. */
  oldValue: string;
  /** Новое значение. Без него стрелка и новое значение не рисуются. */
  newValue?: string;
  newTone?: StrikethroughTone;
  onDark?: boolean;
  /** Кегль в px, как в макете (диапазон 9–13). */
  size?: number;
}

const TONE_CLASS: Record<StrikethroughTone, string> = {
  accent: styles.accent,
  plain: styles.plain,
};

/**
 * Порт `design_ref/components/Strikethrough.dc.html` (atoms.json#Strikethrough).
 * Перечёркнутое старое значение и новое рядом — «было → стало» для цены,
 * оценки стоимости и любых пересчитанных чисел.
 */
const Strikethrough = ({ oldValue, newValue, newTone = 'accent', onDark = false, size = 10.5 }: StrikethroughProps) => {
  const rootClass = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const valueClass = [styles.value, TONE_CLASS[newTone]].filter(Boolean).join(' ');

  return (
    <span className={rootClass} style={{ fontSize: `${size}px` }}>
      <span className={styles.old}>{oldValue}</span>
      {newValue && (
        <>
          <span className={styles.arrow}>→</span>
          <span className={valueClass}>{newValue}</span>
        </>
      )}
    </span>
  );
};

export default Strikethrough;
