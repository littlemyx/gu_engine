import React from 'react';

import AccentText from '../atoms/AccentText';
import Frame from '../atoms/Frame';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './BeforeAfterPair.module.css';

export interface BeforeAfterPairProps {
  /** Подпись левой карточки, например «было:». */
  beforeLabel: string;
  /** Текст левой карточки — формулировка до правки. */
  beforeText: string;
  /** Подпись правой карточки, например «станет:». */
  afterLabel: string;
  /** Текст правой карточки — формулировка после правки. */
  afterText: string;
  /** Ширина пары в px. */
  width?: number;
}

/**
 * Порт `design_ref/components/BeforeAfterPair.dc.html` (molecules.json#k107).
 * Пара карточек «было / станет»: сравнение формулировки до и после правки —
 * левая рамка нейтральная, правая акцентная, обе на бумажной подложке.
 */
const BeforeAfterPair = ({ beforeLabel, beforeText, afterLabel, afterText, width = 400 }: BeforeAfterPairProps) => {
  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <div className={styles.cell}>
        <Frame tone="light" fill="paper" interactive={false} block paddingX={10} paddingY={8}>
          <MutedText text={beforeLabel} size={10.5} />
          <br />
          <TextLabel text={beforeText} size={10.5} />
        </Frame>
      </div>
      <div className={styles.cell}>
        <Frame tone="accent" fill="paper" interactive={false} block paddingX={10} paddingY={8}>
          <AccentText text={afterLabel} tone="accent" size={10.5} />
          <br />
          <TextLabel text={afterText} size={10.5} />
        </Frame>
      </div>
    </div>
  );
};

export default BeforeAfterPair;
