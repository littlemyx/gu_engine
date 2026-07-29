import React from 'react';

import DashedFrame from '../atoms/DashedFrame';
import MutedText from '../atoms/MutedText';

import styles from './MediaPlaceholder.module.css';

export interface MediaPlaceholderProps {
  /** Что должно появиться на месте медиа, например «фон «пирс, закат» — заглушка». */
  label: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/MediaPlaceholder.dc.html` (molecules.json#k061, «ЗАГЛУШКА МЕДИА»).
 * Заглушка на месте ещё не сгенерированного медиа (фон сцены, портрет, аудио):
 * пунктирная рамка с подписью того, чего здесь не хватает, на подложке под цвет хрома.
 */
const MediaPlaceholder = ({ label, onDark = false }: MediaPlaceholderProps) => {
  const rootClass = [styles.root, onDark ? styles.onDark : styles.onLight].join(' ');

  return (
    <div className={rootClass}>
      <DashedFrame kind="add" onDark={onDark} interactive={false} padding={0}>
        <span className={styles.labelWrap}>
          <MutedText text={label} onDark={onDark} size={11.5} />
        </span>
      </DashedFrame>
    </div>
  );
};

export default MediaPlaceholder;
