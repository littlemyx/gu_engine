import React from 'react';

import MutedText from '../atoms/MutedText';

import styles from './PanelFootnote.module.css';

export interface PanelFootnoteProps {
  /** Текст подписи-примечания. */
  text: string;
  /** Живёт на тёмном хроме сайдбара/панели — это умолчание макета. */
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/PanelFootnote.dc.html` (molecules.json#s013,
 * «ПОДПИСЬ-ПРИМЕЧАНИЕ ПАНЕЛИ»).
 * Служебная строка в подвале панели/сайдбара: тонкая верхняя линия отделяет
 * её от контента выше, текст — приглушённый `MutedText`. В макете верхняя
 * линия тянется на всю ширину подвала, поэтому она сверстана border-top на
 * своём же корне, а не через атом `Divider` (тот умеет только фиксированную
 * длину в px, см. `missingAtoms` отчёта).
 */
const PanelFootnote = ({ text, onDark = true }: PanelFootnoteProps) => {
  const className = [styles.root, onDark ? styles.onDark : styles.onLight].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <MutedText text={text} onDark={onDark} quiet={onDark} size={9.5} />
    </div>
  );
};

export default PanelFootnote;
