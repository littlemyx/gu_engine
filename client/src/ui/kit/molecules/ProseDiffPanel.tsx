import React from 'react';

import Frame from '../atoms/Frame';
import Kicker from '../atoms/Kicker';
import PriceTag from '../atoms/PriceTag';
import Strikethrough from '../atoms/Strikethrough';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './ProseDiffPanel.module.css';

export interface ProseDiffPanelProps {
  /** Кикер архивной колонки: «ТЕЙК №2». */
  oldKicker: string;
  /** Стоимость архивного тейка, напр. «$0.021». Без неё цифра не рисуется. */
  oldPrice?: string;
  /** Строка прозы перед изменённым фрагментом. */
  oldBefore?: string;
  /** Изменённый фрагмент — зачёркнут и подсвечен как отклонённый. */
  oldText: string;
  /** Строка прозы после изменённого фрагмента. */
  oldAfter?: string;
  /** Кикер принятой колонки целиком, вместе со статусом: «ТЕЙК №3 · ✎ ПРИНЯТ». */
  newKicker: string;
  newBefore?: string;
  /** Изменённый фрагмент принятого тейка — подсвечен, без зачёркивания. */
  newText: string;
  newAfter?: string;
  /** Ширина панели в px (360–900 в макете) либо `fill` — на всю ширину контейнера. */
  width?: number | 'fill';
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/ProseDiffPanel.dc.html` (molecules.json#k103).
 * Две колонки рядом — отклонённый тейк (зачёркнутая правка, архивная рамка) и
 * принятый (та же правка, но без зачёркивания, акцентная рамка) — для решения
 * «было / принято» при выборе прозы.
 */
const ProseDiffPanel = ({
  oldKicker,
  oldPrice,
  oldBefore,
  oldText,
  oldAfter,
  newKicker,
  newBefore,
  newText,
  newAfter,
  width = 520,
  onDark = false,
}: ProseDiffPanelProps) => {
  const widthCss = width === 'fill' ? '100%' : `${width}px`;
  const highlightTone = onDark ? 'whiteOnDark' : 'accent';

  return (
    <div className={styles.root} style={{ width: widthCss }}>
      <Frame tone={onDark ? 'dark' : 'light'} interactive={false} paddingX={12} paddingY={10}>
        <div className={styles.kickerRow}>
          <Kicker text={oldKicker} tone="neutral" onDark={onDark} size={9} />
          {oldPrice && <PriceTag value={oldPrice} variant="standalone" tone="muted" onDark={onDark} sizePx={9} />}
        </div>
        <div className={styles.prose}>
          {oldBefore && (
            <>
              <TextLabel text={oldBefore} tone="muted" onDark={onDark} size={10.5} />
              <br />
            </>
          )}
          <ToneSurface tone={highlightTone} padding={0}>
            <Strikethrough oldValue={oldText} onDark={onDark} size={10.5} />
          </ToneSurface>
          {oldAfter && (
            <>
              <br />
              <TextLabel text={oldAfter} tone="muted" onDark={onDark} size={10.5} />
            </>
          )}
        </div>
      </Frame>
      <Frame tone="accent" interactive={false} paddingX={12} paddingY={10}>
        <div className={styles.kickerRow}>
          <Kicker text={newKicker} tone="accent" onDark={onDark} size={9} />
        </div>
        <div className={styles.prose}>
          {newBefore && (
            <>
              <TextLabel text={newBefore} onDark={onDark} size={10.5} />
              <br />
            </>
          )}
          <ToneSurface tone={highlightTone} padding={0}>
            <TextLabel text={newText} onDark={onDark} size={10.5} />
          </ToneSurface>
          {newAfter && (
            <>
              <br />
              <TextLabel text={newAfter} onDark={onDark} size={10.5} />
            </>
          )}
        </div>
      </Frame>
    </div>
  );
};

export default ProseDiffPanel;
