import React from 'react';

import styles from './ActionButton.module.css';

export type ActionButtonKind = 'primary' | 'outline' | 'ghost';

export interface ActionButtonProps {
  label: string;
  /** Стоимость всегда печатается в лейбле, никогда в тултипе. */
  cost?: string;
  kind?: ActionButtonKind;
  disabled?: boolean;
  /** Причина недоступности — строкой под кнопкой. Без неё disabled не объяснён. */
  reason?: string;
  block?: boolean;
  /** Кнопка стоит на светлой поверхности — модалка, пустой проект. */
  onLight?: boolean;
  title?: string;
  onClick?: () => void;
}

const KIND_CLASS: Record<ActionButtonKind, string> = {
  primary: styles.primary,
  outline: styles.outline,
  ghost: styles.ghost,
};

/**
 * Действие инспектора. Правила дизайн-системы, зашитые в компонент:
 * стоимость входит в лейбл, а недоступная кнопка всегда объясняет причину.
 * Разрушающие действия оформляются только `outline` и ведут в модалку.
 */
const ActionButton = ({
  label,
  cost,
  kind = 'primary',
  disabled = false,
  reason,
  block = false,
  onLight = false,
  title,
  onClick,
}: ActionButtonProps) => {
  const labelFull = cost ? `${label} · ${cost}` : label;
  const showReason = disabled && Boolean(reason);

  return (
    <div className={`${styles.root} ${block ? styles.block : ''} ${onLight ? styles.onLight : ''}`}>
      <button
        type="button"
        className={`${styles.label} ${KIND_CLASS[kind] ?? KIND_CLASS.primary}`}
        disabled={disabled}
        title={title}
        onClick={onClick}
      >
        {labelFull}
      </button>
      {showReason && <span className={styles.reason}>{reason}</span>}
    </div>
  );
};

export default ActionButton;
