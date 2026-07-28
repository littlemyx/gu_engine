import React from 'react';

import styles from './Radio.module.css';

export interface RadioProps {
  /** Выбрана ли эта радио-точка. Клик по ней всегда переводит её в `true` —
   * снятие выбора отдельной точкой не делается, это работа радио-группы. */
  checked?: boolean;
  label: string;
  /** Скрыть подпись, оставив только кружок — например, в компактном ряду. */
  showLabel?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * Порт `design_ref/components/Radio.dc.html` (atoms.json#Radio).
 * Кружок с точкой — один вариант выбора в радио-группе. Без `onChange`
 * рендерится как немой индикатор состояния, а не интерактивный контрол.
 */
const Radio = ({ checked = true, label, showLabel = true, disabled = false, onChange }: RadioProps) => {
  const className = [
    styles.root,
    onChange ? styles.interactive : '',
    checked ? styles.checked : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  const dial = <span className={styles.dial}>{checked && <span className={styles.dot} aria-hidden="true" />}</span>;
  const labelNode = showLabel ? <span className={styles.label}>{label}</span> : null;

  if (!onChange) {
    return (
      <span className={className} role="radio" aria-checked={checked} aria-disabled={disabled || undefined}>
        {dial}
        {labelNode}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={className}
      disabled={disabled}
      onClick={() => onChange(true)}
    >
      {dial}
      {labelNode}
    </button>
  );
};

export default Radio;
