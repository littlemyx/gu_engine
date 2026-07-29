import React from 'react';

import Counter from '../atoms/Counter';
import Frame from '../atoms/Frame';
import HatchFill from '../atoms/HatchFill';
import TextLabel from '../atoms/TextLabel';

import styles from './SpriteTakeCell.module.css';

/** `принят` — тейк утверждён и стоит в партитуре, `обычная` — рядовой некандидатный тейк. */
export type SpriteTakeCellState = 'accepted' | 'ordinary';

export interface SpriteTakeCellProps {
  /** Номер слота тейка, например 2 → «№2». */
  num: number;
  /** Статусный текст рядом с номером: «принят», «#12» и т.п. */
  label: string;
  state?: SpriteTakeCellState;
  /** Ширина ячейки, px (80–320 в макете) либо `'fill'` — на всю ширину контейнера. */
  width?: number | 'fill';
  /** Высота ячейки, px (60–220 в макете). */
  height?: number;
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/SpriteTakeCell.dc.html` (molecules.json#k104,
 * «ЯЧЕЙКА ТЕЙКА СПРАЙТА · ПРИНЯТ / ОБЫЧНАЯ»).
 * Ячейка тейка спрайта на кастинг-столе конвейера: диагональная штриховка
 * `HatchFill` под номером `Counter` и статусом `TextLabel`, прижатыми к низу.
 * «Принят» красит штриховку и рамку в акцентный тон и утолщает рамку через
 * `Frame`'s `selected` (двойной инсет-контур вместо честных 2px из макета —
 * рамки кита все hairline-1px), «обычная» остаётся нейтральной и тонкой.
 */
const SpriteTakeCell = ({ num, label, state = 'accepted', width = 150, height = 90, onClick }: SpriteTakeCellProps) => {
  const accepted = state === 'accepted';
  const widthCss = width === 'fill' ? '100%' : `${width}px`;

  return (
    <Frame
      tone={accepted ? 'accent' : 'light'}
      selected={accepted}
      interactive={Boolean(onClick)}
      padding={0}
      block={width === 'fill'}
      onClick={onClick}
    >
      <span className={styles.body} style={{ width: widthCss, height: `${height}px` }}>
        <span className={styles.hatchLayer} aria-hidden="true">
          <HatchFill tone={accepted ? 'accent' : 'neutral'} note="" />
        </span>
        <span className={styles.labelSlot}>
          <Counter value={`№${num}`} tone={accepted ? 'accent' : 'neutral'} size={9.5} />
          <span className={styles.sep} aria-hidden="true">
            {' · '}
          </span>
          <TextLabel text={label} bold={accepted} tone={accepted ? 'accent' : 'muted'} size={9.5} />
        </span>
      </span>
    </Frame>
  );
};

export default SpriteTakeCell;
