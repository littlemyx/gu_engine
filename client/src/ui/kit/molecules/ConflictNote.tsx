import React from 'react';

import styles from './ConflictNote.module.css';

export interface ConflictNoteProps {
  /** Текст предупреждения о конфликте. */
  text: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/ConflictNote.dc.html` (molecules.json#s015,
 * «ПРЕДУПРЕЖДЕНИЕ О КОНФЛИКТЕ»).
 * Тонкая рамка с окрашенным текстом: конфликт между рулением и системным
 * решением (▣ × ◐) — некликабельная заметка, рамка и текст одного цвета.
 * Ни `Frame`, ни `AccentText` не дают тона, где рамка и текст красятся одним
 * и тем же сигнальным цветом (см. `missingAtoms` отчёта задачи), поэтому
 * цвет и рамка собраны локально на тех же токенах `--gu-signal-fail*`.
 */
const ConflictNote = ({ text, onDark = false }: ConflictNoteProps) => {
  const className = [styles.root, onDark ? styles.dark : styles.light].filter(Boolean).join(' ');

  return <div className={className}>{text}</div>;
};

export default ConflictNote;
