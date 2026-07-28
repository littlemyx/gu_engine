import React from 'react';

import styles from './Placeholder.module.css';

export interface PlaceholderProps {
  text: string;
  /** На тёмном хроме — светлеет через `--gu-ink-40`, а не через neutral-рампу. */
  onDark?: boolean;
  /** Кегль в px. В макете — диапазон 9–12, по умолчанию 10.5. */
  size?: number;
}

/**
 * Порт `design_ref/components/Placeholder.dc.html` (atoms.json#Placeholder).
 * Приглушённый текст незаполненного поля — «выбрать локацию…» и подобное.
 * Вариантов и состояний в реестре нет: только текст, хром и кегль.
 */
const Placeholder = ({ text, onDark = false, size = 10.5 }: PlaceholderProps) => {
  const className = [styles.root, onDark ? styles.onDark : styles.onLight].join(' ');

  return (
    <span className={className} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  );
};

export default Placeholder;
