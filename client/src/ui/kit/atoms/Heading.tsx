import React from 'react';

import styles from './Heading.module.css';

export type HeadingLevel = 'card' | 'modal' | 'screen';

export interface HeadingProps {
  text: string;
  /** Ступень заголовка: карточный 12–14, модальный 16, экранный 18–20. */
  level?: HeadingLevel;
  uppercase?: boolean;
  onDark?: boolean;
  /** Точный размер в px поверх ступени `level`. */
  size?: number;
}

const LEVEL_CLASS: Record<HeadingLevel, string> = {
  card: styles.card,
  modal: styles.modal,
  screen: styles.screen,
};

/**
 * Порт `design_ref/components/Heading.dc.html` (atoms.json#Heading).
 * Заголовок панели: Barlow Condensed 600, три ступени размера под масштаб
 * контейнера. Заглавные буквы по умолчанию — это отдельная ручка, не часть
 * ступени.
 */
const Heading = ({ text, level = 'card', uppercase = true, onDark = false, size }: HeadingProps) => {
  const className = [styles.root, LEVEL_CLASS[level], onDark ? styles.onDark : '', uppercase ? styles.uppercase : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={size ? { fontSize: size } : undefined}>
      {text}
    </span>
  );
};

export default Heading;
