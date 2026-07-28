import React from 'react';

import styles from './MonoText.module.css';

export interface MonoTextProps {
  text: string;
  /** Строка стоит на тёмном хроме и потому светлеет. */
  onDark?: boolean;
  muted?: boolean;
  /** Подсветка-фон под текстом: совпавший id, найденный seed. */
  highlight?: boolean;
  /** px, 9–12, шаг 0.5. */
  size?: number;
}

/**
 * Порт `design_ref/components/MonoText.dc.html` (atoms.json#MonoText).
 * ui-monospace для служебных строк: id, пути, seed, хэши, счёт — везде, где
 * важна побуквенная выравненность, а не читаемость прозы.
 */
const MonoText = ({ text, onDark = false, muted = false, highlight = false, size = 10 }: MonoTextProps) => {
  const className = [
    styles.root,
    onDark ? styles.onDark : '',
    muted ? styles.muted : '',
    highlight ? styles.highlight : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  );
};

export default MonoText;
