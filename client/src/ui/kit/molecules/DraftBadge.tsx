import React from 'react';

import TextLabel from '../atoms/TextLabel';

import styles from './DraftBadge.module.css';

export interface DraftBadgeProps {
  text: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/DraftBadge.dc.html` (molecules.json#k053).
 * Метка «черновик · прогон идёт»: пунктирная рамка в тон сигнала прогона
 * вокруг короткой подписи. Некликабельна — просто индикатор состояния.
 */
const DraftBadge = ({ text, onDark = false }: DraftBadgeProps) => {
  const className = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span className={className}>
      <TextLabel text={text} onDark={onDark} bold tone="accent" size={10.5} />
    </span>
  );
};

export default DraftBadge;
