import React from 'react';

import MutedText from '../atoms/MutedText';

import styles from './PanelInfoBox.module.css';

export interface PanelInfoBoxProps {
  /** Текст подсказки, например «Дальше: следующий шаг зоны». */
  text: string;
  /** Хром панели: сайдбар студии тёмный, поэтому в макете это умолчание. */
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/PanelInfoBox.dc.html` (molecules.json#s016).
 * Подсказка «Дальше: …» в сайдбаре Замысла/Каркаса: волосяная рамка вокруг
 * приглушённого текста, задаёт следующий шаг зоны студии.
 */
const PanelInfoBox = ({ text, onDark = true }: PanelInfoBoxProps) => {
  const className = [styles.root, onDark ? styles.onDark : styles.onLight].join(' ');

  return (
    <div className={className}>
      <MutedText text={text} onDark={onDark} size={10} />
    </div>
  );
};

export default PanelInfoBox;
