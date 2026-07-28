import React from 'react';

import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';

import styles from './ToolbarActions.module.css';

export interface ToolbarActionsProps {
  /** Подпись основной кнопки запуска. */
  label?: string;
  /** Смета в подписи основной кнопки, моноширинно. */
  price?: string;
  /** Подпись кнопки предпросмотра. */
  previewLabel?: string;
  /** Предпросмотр уже включён — кнопка переходит в нажатый вид. */
  previewActive?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPreview?: () => void;
  onRun?: () => void;
}

/**
 * Порт `design_ref/components/ToolbarActions.dc.html` (molecules.json#k003, «КНОПКИ ТУЛБАРА»).
 * Пара кнопок правого края тулбара: переключатель предпросмотра и главная
 * кнопка запуска с ценником. Живёт только на тёмном хроме студии, поэтому
 * своего `onDark` не несёт.
 */
const ToolbarActions = ({
  label = 'Продолжить конвейер',
  price = '≈$3.46',
  previewLabel = '▶ Превью',
  previewActive = false,
  disabled = false,
  loading = false,
  onPreview,
  onRun,
}: ToolbarActionsProps) => (
  <div className={styles.root}>
    {previewActive ? (
      onPreview ? (
        <button type="button" className={styles.previewActive} onClick={onPreview}>
          {previewLabel}
        </button>
      ) : (
        <span className={styles.previewActive}>{previewLabel}</span>
      )
    ) : (
      <OutlineButton label={previewLabel} tone="neutral" size="compact" onDark onClick={onPreview} />
    )}
    <PrimaryButton
      label={label}
      price={price}
      size="compact"
      marks={false}
      disabled={disabled}
      loading={loading}
      onClick={onRun}
    />
  </div>
);

export default ToolbarActions;
