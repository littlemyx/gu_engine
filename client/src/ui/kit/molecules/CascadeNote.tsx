import React from 'react';

import MutedText from '../atoms/MutedText';

import styles from './CascadeNote.module.css';

export type CascadeNoteWidth = number | 'fill';

export interface CascadeNoteProps {
  /** Пояснение слева: что случится с каскадом/ретеншном при применении. */
  note: string;
  /** Служебная мета справа — например, сколько версий хранится. Без неё колонка не рисуется. */
  right?: string;
  onDark?: boolean;
  /** Ширина строки в px, либо `'fill'` — растянуть на всю доступную ширину. */
  width?: CascadeNoteWidth;
}

/**
 * Порт `design_ref/components/CascadeNote.dc.html` (molecules.json#k106,
 * «ПРИМЕЧАНИЕ О КАСКАДЕ / РЕТЕНШНЕ»).
 * Однострочная сноска под операцией, которая затронет каскад потомков или
 * ретеншн истории: слева — что произойдёт, справа — служебная мета (лимит,
 * политика GC). Обе колонки — `MutedText`, разметка строки своя.
 */
const CascadeNote = ({ note, right, onDark = false, width = 520 }: CascadeNoteProps) => {
  const hasRight = Boolean(right);
  const widthCss = width === 'fill' ? '100%' : `${width}px`;

  return (
    <div className={styles.root} style={{ width: widthCss }}>
      <span className={styles.note}>
        <MutedText text={note} onDark={onDark} size={9.5} />
      </span>
      {hasRight && right ? (
        <span className={styles.right}>
          <MutedText text={right} onDark={onDark} size={9.5} />
        </span>
      ) : null}
    </div>
  );
};

export default CascadeNote;
