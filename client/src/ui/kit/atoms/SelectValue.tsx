import React from 'react';

import styles from './SelectValue.module.css';

export interface SelectValueProps {
  /** Текущее значение селекта. */
  value: string;
  /** Подпись, когда выбор ещё не сделан (`empty`). */
  placeholder?: string;
  /** Выбор не сделан — печатает `placeholder` вместо `value`. */
  empty?: boolean;
  /** Значение отличается от исходного — рамка красится в акцент. */
  changed?: boolean;
  error?: boolean;
  disabled?: boolean;
  /** Минимальная ширина в px, диапазон макета 100–280. */
  width?: number;
  onDark?: boolean;
  /** Раскрыть список. Без колбэка рендерится немой, некликабельный триггер. */
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/SelectValue.dc.html` (atoms.json#SelectValue).
 * Закрытый селект: значение + ▾ в hairline-рамке. `empty` подменяет текст на
 * приглашение выбрать, `changed` и `error` красят рамку — `error` в приоритете.
 */
const SelectValue = ({
  value,
  placeholder = 'выбрать…',
  empty = false,
  changed = false,
  error = false,
  disabled = false,
  width = 150,
  onDark = false,
  onClick,
}: SelectValueProps) => {
  const label = empty ? placeholder : value;
  const muted = disabled || empty;

  const className = [
    styles.root,
    error ? styles.error : changed ? styles.changed : '',
    muted ? styles.muted : '',
    disabled ? styles.disabled : '',
    onDark ? styles.onDark : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = { minWidth: `${width}px` };

  const content = (
    <>
      <span>{label}</span>
      <span className={styles.arrow} aria-hidden="true">
        ▾
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className={className} style={style} aria-disabled={disabled || undefined}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" className={className} style={style} disabled={disabled} onClick={onClick}>
      {content}
    </button>
  );
};

export default SelectValue;
