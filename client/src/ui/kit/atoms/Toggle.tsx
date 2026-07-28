import React from 'react';

import styles from './Toggle.module.css';

export interface ToggleProps {
  /** Текущее положение переключателя. */
  on?: boolean;
  disabled?: boolean;
  /** Подпись рядом с тумблером; данные, а не хардкод. */
  label: string;
  showLabel?: boolean;
  onChange?: (on: boolean) => void;
}

/**
 * Порт `design_ref/components/Toggle.dc.html` (atoms.json#Toggle).
 * Тумблер строгого режима: залитая дорожка на «on», пустая на «off»,
 * бегунок ездит между краями. Без `onChange` рендерится немым индикатором.
 */
const Toggle = ({ on = true, disabled = false, label, showLabel = true, onChange }: ToggleProps) => {
  const rootClass = [styles.root, on ? styles.on : styles.off, disabled ? styles.disabled : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={styles.track}>
        <span className={styles.knob} />
      </span>
      {showLabel && <span className={styles.label}>{label}</span>}
    </>
  );

  if (!onChange) {
    return (
      <span className={rootClass} role="switch" aria-checked={on} aria-disabled={disabled || undefined}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={rootClass}
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      {content}
    </button>
  );
};

export default Toggle;
