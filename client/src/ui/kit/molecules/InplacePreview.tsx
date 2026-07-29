import React from 'react';

import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './InplacePreview.module.css';

export interface InplacePreviewProps {
  /** Подпись поверх превью: сцена и источник (например, префаб). */
  caption: string;
  /** Пояснение сбоку: как именно раскрыто превью в интерфейсе. */
  note: string;
  /** px. В макете — 236. */
  thumbWidth?: number;
  /** px. В макете — 66. */
  thumbHeight?: number;
  /** Строка стоит на тёмной панели — `note` красится через ink-рампу. */
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/InplacePreview.dc.html` (molecules.json#k072
 * «инплейс-превью фона»). Уже сгенерированный фон, развёрнутый прямо в строке
 * конвейера (по ▸), без отдельного окна: миниатюра несёт подпись поверх себя,
 * а не под собой, как заглушка `Thumbnail`, — поэтому плашка снимка сделана
 * локально (см. `missingAtoms`).
 */
const InplacePreview = ({ caption, note, thumbWidth = 236, thumbHeight = 66, onDark = false }: InplacePreviewProps) => (
  <div className={styles.root}>
    <div className={styles.frame} style={{ width: `${thumbWidth}px`, height: `${thumbHeight}px` }}>
      <span className={styles.captionSlot}>
        <TextLabel text={caption} onDark size={8.5} />
      </span>
    </div>
    <MutedText text={note} onDark={onDark} size={10} />
  </div>
);

export default InplacePreview;
