import React from 'react';

import styles from './ToolbarStatus.module.css';

export type ToolbarStatusTone = 'normal' | 'info' | 'error' | 'quiet';

export interface ToolbarStatusProps {
  text: string;
  tone?: ToolbarStatusTone;
  /** Прижать строку к правому краю тулбара (`margin-left: auto`). */
  end?: boolean;
}

const TONE_CLASS: Record<ToolbarStatusTone, string> = {
  normal: styles.normal,
  info: styles.info,
  error: styles.error,
  quiet: styles.quiet,
};

/**
 * Порт `design_ref/components/ToolbarStatus.dc.html` (molecules.json#s012).
 * Строка статуса в шапке зоны шелла: «идёт генерация», «на заглушках»,
 * ошибка прогона. У исходника нет пропа `context` — он всегда живёт на
 * тёмном хроме тулбара/статус-бара, поэтому `onDark` здесь не нужен.
 */
const ToolbarStatus = ({ text, tone = 'normal', end = false }: ToolbarStatusProps) => {
  const className = [styles.root, TONE_CLASS[tone], end ? styles.end : ''].filter(Boolean).join(' ');

  return <span className={className}>{text}</span>;
};

export default ToolbarStatus;
