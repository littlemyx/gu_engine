import React from 'react';

import styles from './Dimming.module.css';

export interface DimmingProps {
  /** Непрозрачность приглушённого содержимого: 0.1–1, по умолчанию 0.4. */
  level?: number;
  onDark?: boolean;
  /** Демо-подпись, если приглушать нечего — фишка вроде «Д2в · Кафе — вне ветки». */
  placeholder?: string;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/Dimming.dc.html` (atoms.json#Dimming).
 * Прозрачность .3–.5 для содержимого вне фокуса, вне активной ветки или
 * disabled — просто оборачивает переданное содержимое в заданный `opacity`.
 */
const Dimming = ({ level = 0.4, onDark = false, placeholder, children }: DimmingProps) => {
  const hasChildren = children !== undefined && children !== null && children !== false;

  return (
    <div className={styles.root} style={{ opacity: level }}>
      {hasChildren ? (
        children
      ) : placeholder ? (
        <span className={[styles.placeholder, onDark ? styles.onDark : ''].filter(Boolean).join(' ')}>
          {placeholder}
        </span>
      ) : null}
    </div>
  );
};

export default Dimming;
