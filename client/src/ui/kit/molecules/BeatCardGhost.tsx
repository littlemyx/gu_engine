import React from 'react';

import AccentText from '../atoms/AccentText';

import styles from './BeatCardGhost.module.css';

export interface BeatCardGhostProps {
  /** Подпись места, куда переносится бит («Б5 · переносится в Д6у…»). */
  label: string;
  onDark?: boolean;
  /** px, как в макете. */
  width?: number;
  /** px, как в макете. */
  height?: number;
}

/**
 * Порт `design_ref/components/BeatCardGhost.dc.html` (molecules.json#s006,
 * «ПРИЗРАК БИТА В ПЕРЕНОСЕ»). Пунктирный след карточки бита, который остаётся
 * в партитуре на время drag-переноса — некликабельная заглушка места и цели.
 * Рамка и заливка у неё держатся постоянно (не только на hover, как у
 * `DashedFrame`), поэтому контур свой, локальный; подпись — атом `AccentText`.
 */
const BeatCardGhost = ({ label, onDark = false, width = 152, height = 60 }: BeatCardGhostProps) => {
  const className = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={className} style={{ width: `${width}px`, height: `${height}px` }}>
      <AccentText text={label} tone="accent" onDark={onDark} size={10} />
    </div>
  );
};

export default BeatCardGhost;
