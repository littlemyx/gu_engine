import React from 'react';

import styles from './AccentText.module.css';

export type AccentTextTone = 'info' | 'accent' | 'error' | 'warn';

export interface AccentTextProps {
  text: string;
  tone?: AccentTextTone;
  onDark?: boolean;
  bold?: boolean;
  /** Кегль в px, как в макете (диапазон 9–14). */
  size?: number;
}

const TONE_CLASS: Record<AccentTextTone, string> = {
  info: styles.info,
  accent: styles.accent,
  error: styles.error,
  warn: styles.warn,
};

/**
 * Порт `design_ref/components/AccentText.dc.html` (atoms.json#AccentText).
 * Смысловой цветной текст: инфо-акцент, обычный акцент, ошибка, предупреждение.
 */
const AccentText = ({ text, tone = 'accent', onDark = false, bold = false, size = 11 }: AccentTextProps) => {
  const className = [styles.root, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px`, fontWeight: bold ? 600 : 400 }}>
      {text}
    </span>
  );
};

export default AccentText;
