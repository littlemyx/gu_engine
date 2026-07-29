import React from 'react';

import Glyph from '../atoms/Glyph';

import styles from './BugReportButton.module.css';

export interface BugReportButtonProps {
  /** Ведущий символ-иконка перед подписью. */
  glyph?: string;
  /** Подпись — обычно описывает, что именно уйдёт в баг-репорт. */
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/BugReportButton.dc.html` (molecules.json#k062,
 * «КНОПКА БАГ-РЕПОРТА»).
 * Тихая утилитарная кнопка: нейтральная рамка и текст, но акцентная (не
 * нейтральная) подсветка hover/active — ни один тон `OutlineButton` не даёт
 * такое сочетание, поэтому кнопка собрана локально на тех же токенах.
 * `context` в исходнике не объявлен — макет светлый, `onDark` не заведён.
 */
const BugReportButton = ({
  glyph = '⎘',
  label = 'Баг-репорт: seed + лог 23 выборов → заметка на юнит',
  disabled = false,
  onClick,
}: BugReportButtonProps) => {
  const content = (
    <>
      <Glyph glyph={glyph} tone="neutral" size={10} />
      <span className={styles.label}>{label}</span>
    </>
  );

  if (!onClick) {
    return (
      <span className={styles.root} aria-disabled={disabled || undefined}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" className={styles.root} disabled={disabled} onClick={disabled ? undefined : onClick}>
      {content}
    </button>
  );
};

export default BugReportButton;
