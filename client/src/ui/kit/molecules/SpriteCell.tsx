import React from 'react';

import Frame from '../atoms/Frame';
import HatchFill from '../atoms/HatchFill';
import TextLabel from '../atoms/TextLabel';

import styles from './SpriteCell.module.css';

export type SpriteCellState = 'accepted' | 'awaiting';

export interface SpriteCellProps {
  /** Подпись тейка, например «идл · №2». */
  label: string;
  state?: SpriteCellState;
  /** Ширина ячейки, px (36–120 в макете). */
  width?: number;
  /** Высота ячейки, px (48–180 в макете). */
  height?: number;
  onClick?: () => void;
}

const STATE_GLYPH: Record<SpriteCellState, string> = {
  accepted: '✓',
  awaiting: '○',
};

/**
 * Порт `design_ref/components/SpriteCell.dc.html` (molecules.json#k073,
 * «ЯЧЕЙКИ СПРАЙТОВ · ПРИНЯТ / ОЖИДАЕТ»). Ячейка тейка спрайта на кастинг-столе:
 * «принят» — тёмная заливка (кадр уже сгенерирован) под двойной акцентной
 * рамкой `Frame` (tone="accent" + selected), «ожидает» — штриховка `HatchFill`
 * поверх обычной рамки (кадра ещё нет). Подпись с глифом-статусом лежит
 * поверх заливки снизу через `TextLabel`.
 */
const SpriteCell = ({ label, state = 'accepted', width = 52, height = 84, onClick }: SpriteCellProps) => {
  const accepted = state === 'accepted';
  const sizeStyle: React.CSSProperties = { width: `${width}px`, height: `${height}px` };

  return (
    <Frame
      tone={accepted ? 'accent' : 'light'}
      selected={accepted}
      interactive={Boolean(onClick)}
      padding={0}
      onClick={onClick}
    >
      <span className={styles.body} style={sizeStyle}>
        {accepted ? (
          <span className={styles.acceptedFill} aria-hidden="true" />
        ) : (
          <span className={styles.hatchLayer} aria-hidden="true">
            <HatchFill note="" />
          </span>
        )}
        <span className={styles.labelSlot}>
          <TextLabel
            text={`${label} ${STATE_GLYPH[state]}`}
            onDark={accepted}
            tone={accepted ? 'normal' : 'muted'}
            size={8}
          />
        </span>
      </span>
    </Frame>
  );
};

export default SpriteCell;
