import React from 'react';

import Counter from '../atoms/Counter';
import DashedFrame from '../atoms/DashedFrame';
import StatusGlyph from '../atoms/StatusGlyph';
import Thumbnail, { type ThumbnailKind } from '../atoms/Thumbnail';

import styles from './PreviewStrip.module.css';

export type PreviewStripKind = 'sprite' | 'location';

export interface PreviewStripTile {
  /** Подпись под миниатюрой (имя позы спрайта, название локации). */
  label: string;
  selected?: boolean;
}

export interface PreviewStripProps {
  kind?: PreviewStripKind;
  tiles: PreviewStripTile[];
  /** Сколько элементов скрыто за плиткой «+N»; 0 или не задано — плитка не рисуется. */
  more?: number;
  onDark?: boolean;
  onTileClick?: (index: number) => void;
}

/** Совпадает с фактическим размером `Thumbnail` при его скейле по умолчанию (1.6). */
const MORE_TILE_SIZE: Record<PreviewStripKind, readonly [number, number]> = {
  sprite: [51, 74],
  location: [90, 54],
};

const THUMBNAIL_KIND: Record<PreviewStripKind, ThumbnailKind> = {
  sprite: 'sprite',
  location: 'location',
};

/**
 * Порт `design_ref/components/PreviewStrip.dc.html` (molecules.json#k026 «мини-превью
 * спрайтов», #k027 «мини-превью локаций»). Ряд мини-превью конвейера с хвостовой плиткой
 * «+N» для остатка, который не поместился в ряд; у локаций хвост несёт ещё и статусный
 * глиф «не создано» (○), у спрайтов — только счётчик.
 */
const PreviewStrip = ({ kind = 'sprite', tiles, more = 0, onDark = false, onTileClick }: PreviewStripProps) => {
  const [moreW, moreH] = MORE_TILE_SIZE[kind];

  return (
    <div className={styles.root}>
      {tiles.map((tile, index) => (
        <Thumbnail
          key={index}
          kind={THUMBNAIL_KIND[kind]}
          label={tile.label}
          selected={tile.selected}
          onDark={onDark}
          onClick={onTileClick ? () => onTileClick(index) : undefined}
        />
      ))}
      {more > 0 && (
        <div className={styles.moreTile} style={{ width: `${moreW}px`, height: `${moreH}px` }}>
          <DashedFrame kind="note" onDark={onDark} interactive={false} padding={0}>
            <Counter value={`+${more}`} onDark={onDark} />
            {kind === 'location' && <StatusGlyph status="none" spin={false} onDark={onDark} />}
          </DashedFrame>
        </div>
      )}
    </div>
  );
};

export default PreviewStrip;
