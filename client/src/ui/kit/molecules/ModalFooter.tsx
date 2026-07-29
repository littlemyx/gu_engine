import React from 'react';

import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';

import styles from './ModalFooter.module.css';

export interface ModalFooterProps {
  cancelLabel?: string;
  confirmLabel?: string;
  /** Смета печатается прямо в кнопке подтверждения, моноширинным. */
  price?: string;
  /** Волосяная черта сверху, отделяющая футер от тела модала. */
  divider?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Ширина футера, px — модал сам решает, насколько он широк. */
  width?: number;
  onCancel?: () => void;
  onConfirm?: () => void;
}

/**
 * Порт `design_ref/components/ModalFooter.dc.html` (molecules.json#p010).
 * Футер модала: пара действий у правого края — второстепенная отмена и
 * главное подтверждение, разделённые волосяной чертой сверху.
 */
const ModalFooter = ({
  cancelLabel = 'Сбросить к дефолтам',
  confirmLabel = 'Применить',
  price = '',
  divider = true,
  disabled = false,
  loading = false,
  width = 400,
  onCancel,
  onConfirm,
}: ModalFooterProps) => {
  const className = [styles.root, divider ? styles.divided : ''].filter(Boolean).join(' ');

  return (
    <div className={className} style={{ width: `${width}px` }}>
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

export default ModalFooter;
