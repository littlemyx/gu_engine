import React from 'react';

import styles from './Shadow.module.css';

export type ShadowSize = 'sm' | 'md' | 'lg';

export interface ShadowProps {
  size?: ShadowSize;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<ShadowSize, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * Порт `design_ref/components/Shadow.dc.html` (atoms.json#Shadow).
 * Обёртка, задающая тень по токену `--shadow-sm/md/lg` (меню, поповеры,
 * модалы). Без `children` показывает плашку-превью с именем токена — так же,
 * как ведёт себя макет.
 */
const Shadow = ({ size = 'md', children }: ShadowProps) => {
  const token = `--shadow-${size}`;
  const rootClass = [styles.root, SIZE_CLASS[size]].join(' ');

  return <div className={rootClass}>{children ?? <div className={styles.placeholder}>{token}</div>}</div>;
};

export default Shadow;
