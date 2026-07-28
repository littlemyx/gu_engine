import React, { useState } from 'react';

import styles from './Stepper.module.css';

export interface StepperProps {
  /** Текущее значение. Неконтролируемый по умолчанию — не пере-задавать на каждый рендер. */
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Единица после числа: «сек», «шт» — печатается прямо в значении. */
  unit?: string;
  /** Подпись над полем. */
  label?: string;
  showLabel?: boolean;
  disabled?: boolean;
  onChange?: (value: number) => void;
}

/**
 * Порт `design_ref/components/Stepper.dc.html` (atoms.json#Stepper).
 * Числовое поле с парой кнопок ▲▼: шаг `step` внутри границ `min`–`max`.
 */
const Stepper = ({
  value,
  min = 0,
  max = 99,
  step = 1,
  unit = '',
  label = 'слотов',
  showLabel = true,
  disabled = false,
  onChange,
}: StepperProps) => {
  const [local, setLocal] = useState<number | null>(null);
  const val = local ?? value ?? 4;

  const commit = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    setLocal(clamped);
    onChange?.(clamped);
  };

  const valueText = unit ? `${val} ${unit}` : String(val);
  const fieldClass = [styles.field, disabled ? styles.disabled : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.root}>
      {showLabel && <span className={styles.label}>{label}</span>}
      <div className={fieldClass}>
        <div className={styles.value}>{valueText}</div>
        <div className={styles.buttons}>
          <button
            type="button"
            aria-label="больше"
            className={styles.btn}
            disabled={disabled}
            onClick={() => commit(val + step)}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="меньше"
            className={`${styles.btn} ${styles.btnDown}`}
            disabled={disabled}
            onClick={() => commit(val - step)}
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
};

export default Stepper;
