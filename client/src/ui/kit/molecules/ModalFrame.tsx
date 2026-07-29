import React from 'react';

import CornerMarks from '../atoms/CornerMarks';
import Heading from '../atoms/Heading';
import Kicker from '../atoms/Kicker';
import MutedText from '../atoms/MutedText';
import Shadow from '../atoms/Shadow';

import styles from './ModalFrame.module.css';

export interface ModalFrameProps {
  /** Надзаголовок, напр. «ПРОГОН #13». */
  kicker: string;
  /** Заголовок модала, напр. «Колл-щит». */
  title: string;
  /** Необязательная приписка рядом с заголовком. */
  subtitle?: string;
  /** Ширина модала в px; в макете диапазон 180–560, по умолчанию 240. */
  width?: number;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/ModalFrame.dc.html` (molecules.json#k034,
 * «БЛЮПРИНТ-РАМКА МОДАЛА»). Чертёжная рамка диалога: реперы по углам, кикер и
 * заголовок в шапке, тень и произвольное содержимое ниже. Обёртка превью
 * (`backdrop`, отступ вокруг) в макете — обвязка редактора дизайна и в порт не
 * входит; фон подкладывает тот, кто размещает модал на экране.
 */
const ModalFrame = ({ kicker, title, subtitle, width = 240, children }: ModalFrameProps) => {
  return (
    <Shadow size="lg">
      <CornerMarks tone="plain">
        <div className={styles.root} role="dialog" style={{ width: `${width}px` }}>
          <div className={styles.kickerRow}>
            <Kicker text={kicker} size={8.5} />
          </div>
          <div className={styles.titleRow}>
            <Heading text={title} level="modal" uppercase={false} size={15} />
            {subtitle && <MutedText text={subtitle} size={11} />}
          </div>
          <div className={styles.body}>{children}</div>
        </div>
      </CornerMarks>
    </Shadow>
  );
};

export default ModalFrame;
