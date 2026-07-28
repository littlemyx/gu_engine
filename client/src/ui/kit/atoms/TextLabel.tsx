import React from 'react';

import styles from './TextLabel.module.css';

export interface TextLabelProps {
  text: string;
  /** Метка стоит на тёмном хроме и потому светлеет. */
  onDark?: boolean;
  bold?: boolean;
  /** px, 9–14, шаг 0.5. */
  size?: number;
}

/**
 * Порт `design_ref/components/TextLabel.dc.html` (atoms.json#TextLabel).
 * Базовый текст интерфейса: подписи, значения полей, служебные строки —
 * везде, где не нужен готовый заголовок или моноширинный счётчик.
 */
const TextLabel = ({ text, onDark = false, bold = false, size = 11.5 }: TextLabelProps) => {
  const className = [styles.root, onDark ? styles.onDark : '', bold ? styles.bold : ''].filter(Boolean).join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  );
};

export default TextLabel;
