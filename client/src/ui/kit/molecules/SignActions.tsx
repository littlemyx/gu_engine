import React from 'react';

import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';

import styles from './SignActions.module.css';

export interface SignActionsProps {
  cancelLabel?: string;
  confirmLabel?: string;
  /** Смета печатается моноширинным прямо в кнопке подтверждения. */
  price?: string;
  disabled?: boolean;
  loading?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}

/**
 * Порт `design_ref/components/SignActions.dc.html` (molecules.json#k043/#k110).
 * Пара кнопок подписи сметы: контурная «Отмена» рядом с залитым «Подписать» —
 * компактный размер, без крестиков-реперов, чтобы влезать в узкую полосу конвейера.
 */
const SignActions = ({
  cancelLabel = 'Отмена',
  confirmLabel = 'Подписать смету и запустить',
  price = '',
  disabled = false,
  loading = false,
  onCancel,
  onConfirm,
}: SignActionsProps) => {
  return (
    <div className={styles.root}>
      <OutlineButton label={cancelLabel} size="compact" onClick={onCancel} />
      <PrimaryButton
        label={confirmLabel}
        price={price || undefined}
        size="compact"
        marks={false}
        disabled={disabled}
        loading={loading}
        onClick={onConfirm}
      />
    </div>
  );
};

export default SignActions;
