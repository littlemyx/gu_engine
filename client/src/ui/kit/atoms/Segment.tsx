import React from 'react';

import styles from './Segment.module.css';

export interface SegmentProps {
  label: string;
  /** Выбранная опция сегментированного переключателя — несёт заливку. */
  selected?: boolean;
  disabled?: boolean;
  /** Подпись под лейблом; недоступная опция по умолчанию подписывается «скоро». */
  note?: string;
  onDark?: boolean;
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/Segment.dc.html` (atoms.json#Segment).
 * Одна опция сегментированного переключателя: заливка несёт выбор, контур —
 * обычное состояние, а недоступная опция гаснет и подписывается «скоро».
 */
const Segment = ({ label, selected = false, disabled = false, note, onDark = false, onClick }: SegmentProps) => {
  const resolvedNote = note ?? (disabled ? 'скоро' : '');
  const hasNote = resolvedNote !== '';

  const className = [styles.root, selected ? styles.selected : '', onDark ? styles.onDark : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span>{label}</span>
      {hasNote && <span className={styles.note}>{resolvedNote}</span>}
    </>
  );

  if (!onClick) {
    return (
      <span className={className} aria-disabled={disabled || undefined}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={disabled ? undefined : onClick}>
      {content}
    </button>
  );
};

export default Segment;
