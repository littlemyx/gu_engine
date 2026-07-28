import React from 'react';

import styles from './OutlineButton.module.css';

export type OutlineButtonTone = 'neutral' | 'accent' | 'danger';
export type OutlineButtonSize = 'regular' | 'compact';

export interface OutlineButtonProps {
  label: string;
  tone?: OutlineButtonTone;
  size?: OutlineButtonSize;
  onDark?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const TONE_CLASS: Record<OutlineButtonTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  danger: styles.danger,
};

/**
 * Порт `design_ref/components/OutlineButton.dc.html` (atoms.json#OutlineButton).
 * Бордюрная кнопка второго плана: контур несёт тон, заливки нет — она
 * появляется только на hover/active. Живёт и на светлой рабочей области,
 * и на тёмном хроме студии.
 */
const OutlineButton = ({
  label,
  tone = 'neutral',
  size = 'regular',
  onDark = false,
  disabled = false,
  onClick,
}: OutlineButtonProps) => {
  const className = [
    styles.root,
    size === 'compact' ? styles.compact : styles.regular,
    TONE_CLASS[tone],
    onDark ? styles.onDark : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!onClick) {
    return (
      <span className={className} aria-disabled={disabled || undefined}>
        {label}
      </span>
    );
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={disabled ? undefined : onClick}>
      {label}
    </button>
  );
};

export default OutlineButton;
