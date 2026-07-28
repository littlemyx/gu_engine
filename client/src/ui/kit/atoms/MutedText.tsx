import React from 'react';

import styles from './MutedText.module.css';

export interface MutedTextProps {
  text: string;
  /** На тёмном хроме — светлеет через `--gu-ink-*`, а не через neutral-рампу. */
  onDark?: boolean;
  /** Вторая ступень приглушённости: ещё тише, чем обычный вторичный текст. */
  quiet?: boolean;
  /** Кегль в px. В макете — диапазон 8.5–13, по умолчанию 10.5. */
  size?: number;
}

/**
 * Порт `design_ref/components/MutedText.dc.html` (atoms.json#MutedText).
 * Пояснительный/вторичный текст (hint, мета) — самый частый атом кита,
 * встречается в 29 молекулах. Цвет зависит от хрома (светлый/тёмный) и от
 * того, приглушать ли его ещё сильнее.
 */
const MutedText = ({ text, onDark = false, quiet = false, size = 10.5 }: MutedTextProps) => {
  const className = [styles.root, onDark ? styles.onDark : styles.onLight, quiet ? styles.quiet : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  );
};

export default MutedText;
