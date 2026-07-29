import React from 'react';

import Chip from '../atoms/Chip';
import DashedFrame from '../atoms/DashedFrame';
import Glyph from '../atoms/Glyph';
import ToneSurface from '../atoms/ToneSurface';

import styles from './TranscriptChip.module.css';

export type TranscriptChipTone = 'обычный' | 'текущий' | 'предупреждение';

export interface TranscriptChipProps {
  /** Текст реплики/пометки транскрипта. */
  label: string;
  tone?: TranscriptChipTone;
  /** Клик по чипу — например, прыжок к этому месту партитуры. Без колбэка чип не кликабелен. */
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/TranscriptChip.dc.html` (molecules.json#k064,
 * «ЧИПЫ ТРАНСКРИПТА · ОБЫЧНЫЙ / ТЕКУЩИЙ / ПРЕДУПРЕЖДЕНИЕ»).
 * Метка реплики в ленте транскрипта: обычная — нейтральная рамка (`Chip`
 * outline); текущая — акцентная подложка (`ToneSurface`) со стрелкой `►`
 * (`Glyph`), выделяет активную реплику; предупреждение — пунктирная рамка
 * (`DashedFrame`) с `⚠`, когда история дальше уже разошлась с этой веткой.
 */
const TranscriptChip = ({ label, tone = 'обычный', onClick }: TranscriptChipProps) => {
  let frame: React.ReactNode;

  if (tone === 'текущий') {
    frame = (
      <ToneSurface tone="accent" padding={0}>
        <span className={styles.currentBody}>
          <Glyph glyph="►" tone="accent" size={9.5} />
          {label}
        </span>
      </ToneSurface>
    );
  } else if (tone === 'предупреждение') {
    frame = (
      <DashedFrame kind="note" interactive={false} padding={0}>
        <span className={styles.warnBody}>
          <Glyph glyph="⚠" tone="muted" size={9.5} />
          {label}
        </span>
      </DashedFrame>
    );
  } else {
    frame = <Chip label={label} kind="outline" />;
  }

  if (!onClick) {
    return frame;
  }

  return (
    <button type="button" className={styles.trigger} onClick={onClick}>
      {frame}
    </button>
  );
};

export default TranscriptChip;
