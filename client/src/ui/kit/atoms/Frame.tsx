import React from 'react';

import styles from './Frame.module.css';

export type FrameTone = 'light' | 'dark' | 'accent';

export interface FrameProps {
  tone?: FrameTone;
  selected?: boolean;
  /** Управляет фокусируемостью и hover-откликом рамки. */
  interactive?: boolean;
  padding?: number;
  children?: React.ReactNode;
}

const TONE_CLASS: Record<FrameTone, string> = {
  light: styles.light,
  dark: styles.dark,
  accent: styles.accent,
};

/**
 * Порт `design_ref/components/Frame.dc.html` (atoms.json#Frame).
 * Hairline-бордюр 1px — базовый контейнер-контур системы square-corner: три
 * тона рамки, отметка выбора инсетом и hover/focus для интерактивных мест.
 */
const Frame = ({ tone = 'light', selected = false, interactive = true, padding = 12, children }: FrameProps) => {
  const className = [
    styles.root,
    TONE_CLASS[tone],
    selected ? styles.selected : '',
    interactive ? styles.interactive : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} style={{ padding: `${padding}px` }} tabIndex={interactive ? 0 : undefined}>
      {children}
    </div>
  );
};

export default Frame;
