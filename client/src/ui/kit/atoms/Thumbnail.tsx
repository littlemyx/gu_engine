import React from 'react';

import styles from './Thumbnail.module.css';

export type ThumbnailKind = 'sprite' | 'location' | 'stub';

export interface ThumbnailProps {
  kind?: ThumbnailKind;
  /** Подпись под миниатюрой (спрайт/локация) либо счётчик заглушки (`+3`). */
  label: string;
  /** Осмысленно только для спрайта/локации: заглушка выбор не носит. */
  selected?: boolean;
  onDark?: boolean;
  /** Множитель базового размера варианта. */
  scale?: number;
  onClick?: () => void;
}

const BASE_SIZE: Record<ThumbnailKind, readonly [number, number]> = {
  sprite: [32, 46],
  location: [56, 34],
  stub: [32, 46],
};

/**
 * Порт `design_ref/components/Thumbnail.dc.html` (atoms.json#Thumbnail).
 * Мини-превью медиа для панелей кастинга и карты мира: спрайт и локация несут
 * штрихованную заливку с подписью снизу, +N-заглушка — пунктирный счётчик.
 */
const Thumbnail = ({
  kind = 'sprite',
  label,
  selected = false,
  onDark = false,
  scale = 1.6,
  onClick,
}: ThumbnailProps) => {
  const isStub = kind === 'stub';
  const [baseW, baseH] = BASE_SIZE[kind];
  const size = {
    width: `${Math.round(baseW * scale)}px`,
    height: `${Math.round(baseH * scale)}px`,
  };

  const className = [
    styles.root,
    isStub ? styles.stub : styles.media,
    onDark ? styles.onDark : '',
    !isStub && selected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = isStub ? label : <span className={styles.label}>{label}</span>;

  if (!onClick) {
    return (
      <span className={className} style={size}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" className={className} style={size} onClick={onClick}>
      {content}
    </button>
  );
};

export default Thumbnail;
