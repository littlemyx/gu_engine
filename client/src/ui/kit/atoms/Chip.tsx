import React from 'react';

import styles from './Chip.module.css';

export type ChipKind = 'tinted' | 'outline' | 'removable' | 'add' | 'error' | 'warn';

export interface ChipProps {
  label: string;
  kind?: ChipKind;
  onDark?: boolean;
  /** Снять метку. Осмыслен только у `removable`. */
  onRemove?: () => void;
  /** Добавить метку. Осмыслен только у `add`. */
  onClick?: () => void;
}

const KIND_CLASS: Record<ChipKind, string> = {
  tinted: styles.tinted,
  outline: styles.outline,
  removable: styles.tinted,
  add: styles.add,
  error: styles.error,
  warn: styles.warn,
};

/**
 * Порт `design_ref/components/Chip.dc.html` (atoms.json#Chip).
 * Метка-фишка: жанр, флаг, тег. `add` — пунктирная кнопка «добавить»,
 * `removable` — залитая фишка с крестиком.
 */
const Chip = ({ label, kind = 'tinted', onDark = false, onRemove, onClick }: ChipProps) => {
  const className = [styles.root, KIND_CLASS[kind], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  if (kind === 'add') {
    return (
      <button type="button" className={className} onClick={onClick}>
        + {label}
      </button>
    );
  }

  return (
    <span className={className}>
      {label}
      {kind === 'removable' && (
        <button type="button" className={styles.remove} aria-label={`Убрать ${label}`} onClick={onRemove}>
          ✕
        </button>
      )}
    </span>
  );
};

export default Chip;
