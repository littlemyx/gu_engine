import React from 'react';

import Heading from '../atoms/Heading';
import MutedText from '../atoms/MutedText';
import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';

import styles from './EmptyState.module.css';

export type EmptyStateActionKind = 'primary' | 'outline';

export interface EmptyStateProps {
  title: string;
  hint: string;
  actionLabel: string;
  /** Взаимоисключающий вид кнопки действия: залитая или контурная. */
  actionKind?: EmptyStateActionKind;
  onDark?: boolean;
  onAction?: () => void;
}

/**
 * Порт `design_ref/components/EmptyState.dc.html` (molecules.json#p043).
 * Пустое состояние вкладки вьюпорта: заголовок + пояснение + одна кнопка
 * запуска генерации. Живёт и на светлой рабочей области, и на тёмном хроме.
 */
const EmptyState = ({
  title,
  hint,
  actionLabel,
  actionKind = 'primary',
  onDark = false,
  onAction,
}: EmptyStateProps) => {
  const rootClassName = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <Heading text={title} level="card" size={12} onDark={onDark} />
      <div className={styles.hint}>
        <MutedText text={hint} size={10} quiet onDark={onDark} />
      </div>
      <div className={styles.actions}>
        {actionKind === 'primary' ? (
          <PrimaryButton label={actionLabel} size="compact" marks={false} onClick={onAction} />
        ) : (
          <OutlineButton label={actionLabel} size="compact" onDark={onDark} onClick={onAction} />
        )}
      </div>
    </div>
  );
};

export default EmptyState;
