import React from 'react';

import MutedText from '../atoms/MutedText';

import styles from './ToolbarSelect.module.css';

export interface ToolbarSelectProps {
  /** Подпись перед значением, напр. «ветка:». Пустая строка скрывает подпись. */
  label?: string;
  value: string;
  /** Стрелка ▾ после значения. */
  arrow?: boolean;
  /** Моноширинный шрифт значения — для технических селектов (политика, слой). */
  mono?: boolean;
  /** Значение отличается от исходного — рамка красится в акцент. */
  changed?: boolean;
  disabled?: boolean;
  /** Раскрыть список. Без колбэка рендерится немой, некликабельный триггер. */
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/ToolbarSelect.dc.html` (molecules.json#p047, «ТУЛБАР-СЕЛЕКТ»).
 * Закрытый селект тулбара: ветка, политика правок, активный слой карты.
 * Живёт только на тёмном хроме студии, поэтому своего `onDark` не несёт.
 */
const ToolbarSelect = ({
  label = 'ветка:',
  value,
  arrow = true,
  mono = false,
  changed = false,
  disabled = false,
  onClick,
}: ToolbarSelectProps) => {
  const hasLabel = label !== '';
  const valueText = value + (arrow ? ' ▾' : '');

  const triggerClassName = [
    styles.trigger,
    mono ? styles.mono : '',
    changed ? styles.changed : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.root}>
      {hasLabel && <MutedText text={label} onDark size={12} />}
      {onClick ? (
        <button type="button" className={triggerClassName} disabled={disabled} onClick={onClick}>
          {valueText}
        </button>
      ) : (
        <span className={triggerClassName} aria-disabled={disabled || undefined}>
          {valueText}
        </span>
      )}
    </div>
  );
};

export default ToolbarSelect;
