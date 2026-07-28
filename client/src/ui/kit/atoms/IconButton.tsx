import React from 'react';

import styles from './IconButton.module.css';

export type IconButtonSize = 'inline' | 'toolbar';
export type IconButtonTone = 'neutral' | 'danger';

export interface IconButtonProps {
  /** Неизменяемый глиф кнопки: ▶, ⟳, ⋯, ✕. */
  glyph: string;
  /** Подпись — уходит и в `title`, и в `aria-label`: видимого текста у кнопки нет. */
  hint: string;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  onDark?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const SIZE_CLASS: Record<IconButtonSize, string> = {
  inline: styles.inline,
  toolbar: styles.toolbar,
};

const TONE_CLASS: Record<IconButtonTone, string> = {
  neutral: styles.neutral,
  danger: styles.danger,
};

/**
 * Порт `design_ref/components/IconButton.dc.html` (atoms.json#IconButton).
 * Квадратная мини-кнопка-глиф: строчная версия — 16px без рамки, для
 * действий прямо в тексте; тулбарная — 24px с волосяной рамкой, для панели
 * инструментов. Тон меняет только цвет глифа, фон подсветки общий.
 */
const IconButton = ({
  glyph,
  hint,
  size = 'inline',
  tone = 'neutral',
  onDark = false,
  disabled = false,
  onClick,
}: IconButtonProps) => {
  const className = [styles.root, SIZE_CLASS[size], TONE_CLASS[tone], onDark ? styles.onDark : '']
    .filter(Boolean)
    .join(' ');

  if (!onClick) {
    return (
      <span className={className} title={hint} aria-label={hint} aria-disabled={disabled || undefined}>
        {glyph}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      title={hint}
      aria-label={hint}
      onClick={disabled ? undefined : onClick}
    >
      {glyph}
    </button>
  );
};

export default IconButton;
