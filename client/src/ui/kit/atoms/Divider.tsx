import React from 'react';

import styles from './Divider.module.css';

export type DividerOrientation = 'vertical' | 'horizontal';

export interface DividerProps {
  orientation?: DividerOrientation;
  /** Приглушённый штрих — чуть менее заметный, чем обычный. */
  quiet?: boolean;
  /** Дивайдер живёт на тёмном хроме тулбара/меню — это умолчание макета. */
  onDark?: boolean;
  /** Длина штриха вдоль своей оси, px. */
  length?: number;
}

/**
 * Порт `design_ref/components/Divider.dc.html` (atoms.json#Divider).
 * 1px линия-разделитель для тулбаров и меню: вертикальный штрих между
 * кнопками или горизонтальная черта между пунктами.
 */
const Divider = ({ orientation = 'vertical', quiet = false, onDark = true, length = 20 }: DividerProps) => {
  const vertical = orientation === 'vertical';
  const className = [
    styles.root,
    vertical ? styles.vertical : styles.horizontal,
    onDark ? styles.onDark : '',
    quiet ? styles.quiet : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = vertical ? { height: `${length}px` } : { width: `${length}px` };

  return <span className={className} style={style} aria-hidden="true" />;
};

export default Divider;
