import React from 'react';

import Frame from '../atoms/Frame';
import Glyph from '../atoms/Glyph';
import MonoText from '../atoms/MonoText';
import ToneSurface from '../atoms/ToneSurface';

import styles from './SpriteStage.module.css';

/** Кто говорит сейчас — ровно один из трёх взаимоисключающих вариантов. */
export type SpriteStageSpeaking = 'слева' | 'справа' | 'никто';

export interface SpriteStageProps {
  /** Служебная строка над левым спрайтом, например «left · asel_idle». */
  leftLabel?: string;
  /** Служебная строка над правым спрайтом, например «right · mia_soft · говорит». */
  rightLabel?: string;
  /** Кто говорит: увеличивает и подсвечивает соответствующий спрайт и подпись, второй тускнеет. */
  speaking?: SpriteStageSpeaking;
  /** Ширина сцены, px (260–800 в макете); высота считается от соотношения сторон 16:7. */
  width?: number;
}

/**
 * Порт `design_ref/components/SpriteStage.dc.html` (molecules.json#p003,
 * «СЦЕНА СО СПРАЙТАМИ»). Кадр диалоговой сцены движка: два спрайта-полукруга
 * `Glyph` по краям тёмной подложки (`Frame` + `ToneSurface`), над каждым —
 * путь позы `MonoText`. Говорящий персонаж крупнее и ярче, немой тускнеет —
 * ровно один из трёх `speaking` побеждает.
 *
 * `MonoText` не несёт сигнального (синеватого) тона на тёмном хроме — только
 * `onDark`/`muted` — поэтому подпись говорящего просто ярче немой, а не
 * подкрашена в `--gu-signal-run`, как в макете (см. `missingAtoms` отчёта).
 */
const SpriteStage = ({
  leftLabel = 'left · asel_idle',
  rightLabel = 'right · mia_soft · говорит',
  speaking = 'справа',
  width = 400,
}: SpriteStageProps) => {
  const leftLit = speaking === 'слева';
  const rightLit = speaking === 'справа';
  const leftGlyphSize = Math.round(width * (leftLit ? 0.185 : 0.16));
  const rightGlyphSize = Math.round(width * (rightLit ? 0.185 : 0.16));

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <Frame tone="light" block interactive={false} padding={0}>
        <span className={styles.toneStretch}>
          <ToneSurface tone="darkAccent" padding={0}>
            <div className={styles.stage}>
              <span className={`${styles.glyphSlot} ${styles.glyphSlotLeft}`}>
                <Glyph glyph="◐" tone={leftLit ? 'info' : 'muted'} size={leftGlyphSize} onDark />
              </span>
              <span className={`${styles.glyphSlot} ${styles.glyphSlotRight}`}>
                <Glyph glyph="◐" tone={rightLit ? 'info' : 'muted'} size={rightGlyphSize} onDark />
              </span>
              <span className={`${styles.labelSlot} ${styles.labelSlotLeft}`}>
                <MonoText text={leftLabel} onDark muted={!leftLit} size={9} />
              </span>
              <span className={`${styles.labelSlot} ${styles.labelSlotRight}`}>
                <MonoText text={rightLabel} onDark muted={!rightLit} size={9} />
              </span>
            </div>
          </ToneSurface>
        </span>
      </Frame>
    </div>
  );
};

export default SpriteStage;
