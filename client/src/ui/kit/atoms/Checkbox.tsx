import React from 'react';

import styles from './Checkbox.module.css';

export interface CheckboxProps {
  /** Подпись рядом с квадратом. Осмыслена, только если `showLabel`. */
  label: string;
  checked?: boolean;
  disabled?: boolean;
  /** Прячет подпись, оставляя один квадрат (например, в плотной строке таблицы). */
  showLabel?: boolean;
  onDark?: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * Порт `design_ref/components/Checkbox.dc.html` (atoms.json#Checkbox).
 * Квадрат 13px: заливка+✓ отмеченного, контур пустого, dashed-рамка
 * недоступного. Без колбэка превращается в неинтерактивный индикатор.
 */
const Checkbox = ({
  label,
  checked = false,
  disabled = false,
  showLabel = true,
  onDark = false,
  onChange,
}: CheckboxProps) => {
  const rootClass = [
    styles.root,
    checked ? styles.checked : '',
    disabled ? styles.disabled : '',
    onChange ? styles.interactive : '',
    onDark ? styles.onDark : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={styles.box} aria-hidden="true">
        {checked && <span className={styles.mark}>✓</span>}
      </span>
      {showLabel && <span className={styles.label}>{label}</span>}
    </>
  );

  if (!onChange) {
    return (
      <span className={rootClass} role="checkbox" aria-checked={checked} aria-disabled={disabled || undefined}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={rootClass}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      {content}
    </button>
  );
};

export default Checkbox;
