import React from 'react';

import DashedFrame from '../atoms/DashedFrame';
import MutedText from '../atoms/MutedText';

import styles from './HintNote.module.css';

export interface HintNoteProps {
  /** Текст подсказки/примечания. */
  text: string;
  onDark?: boolean;
  /** Ширина блока в px; в макете диапазон 180–460, по умолчанию 300. */
  width?: number;
}

/**
 * Порт `design_ref/components/HintNote.dc.html` (molecules.json#k032,
 * «ПРИМЕЧАНИЕ-ПОДСКАЗКА»).
 * Пунктирная заметка с приглушённым текстом: пояснение или подсказка рядом
 * с полем, некликабельна. Собрана из атомов `DashedFrame` (вид `note`) и
 * `MutedText`; собственная разметка нужна только для ширины и внутреннего
 * отступа 8×10, которых нет в пропсах атома-рамки.
 */
const HintNote = ({ text, onDark = false, width = 300 }: HintNoteProps) => {
  return (
    <DashedFrame kind="note" onDark={onDark} padding={0} interactive={false}>
      <div className={styles.body} style={{ width: `${width}px` }}>
        <MutedText text={text} onDark={onDark} size={10} />
      </div>
    </DashedFrame>
  );
};

export default HintNote;
