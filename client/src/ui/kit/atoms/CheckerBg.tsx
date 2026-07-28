import React from 'react';

import styles from './CheckerBg.module.css';

export interface CheckerBgProps {
  /** Сторона клетки шахматки, px. */
  cell?: number;
  /** Ширина области, px. */
  width?: number;
  /** Высота области, px. */
  height?: number;
  /** Волосяная рамка по периметру. */
  framed?: boolean;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/CheckerBg.dc.html` (atoms.json#CheckerBg).
 * Шахматный фон прозрачного PNG: подложка под превью спрайтов и прочих
 * ассетов с альфа-каналом, размер и шаг клетки настраиваются пропсами.
 */
const CheckerBg = ({ cell = 14, width = 180, height = 120, framed = true, children }: CheckerBgProps) => {
  const style: React.CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    backgroundSize: `${cell}px ${cell}px`,
  };

  const rootClass = [styles.root, framed ? styles.framed : ''].filter(Boolean).join(' ');
  const content = children ?? <span className={styles.glyph}>◐</span>;

  return (
    <div className={rootClass} style={style}>
      {content}
    </div>
  );
};

export default CheckerBg;
