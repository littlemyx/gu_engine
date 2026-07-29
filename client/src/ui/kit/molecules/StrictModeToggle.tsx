import React from 'react';

import styles from './StrictModeToggle.module.css';

export interface StrictModeToggleProps {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * Порт `design_ref/components/StrictModeToggle.dc.html` (molecules.json#k058
 * «Тумблер строгого режима»).
 * Переключатель режима прогона на конвейере: включён — прогон проверяется
 * строго, как релиз, выключен — черновой прогон. Глиф (▣/▢) и жирность
 * подписи несут состояние, рамка на тёмном хроме статус-бара конвейера.
 */
const StrictModeToggle = ({
  label = 'строгий режим «как релиз»',
  checked = false,
  disabled = false,
  onChange,
}: StrictModeToggleProps) => {
  const className = [styles.root, checked ? styles.on : styles.off, onChange ? styles.interactive : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span aria-hidden="true">{checked ? '▣' : '▢'}</span> {label}
    </>
  );

  if (!onChange) {
    return (
      <span className={className} role="switch" aria-checked={checked} aria-disabled={disabled || undefined}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={className}
      disabled={disabled}
      onClick={disabled ? undefined : () => onChange(!checked)}
    >
      {content}
    </button>
  );
};

export default StrictModeToggle;
