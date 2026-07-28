import React from 'react';

import styles from './Playhead.module.css';

export type PlayheadTone = 'accent' | 'contrast';

export interface PlayheadProps {
  /** Позиция по горизонтали внутри позиционированного родителя, 0–100%. */
  position?: number;
  /** Высота риски в px. */
  height?: number;
  tone?: PlayheadTone;
  /** Флажок-держатель сверху риски. */
  withHandle?: boolean;
}

const TONE_CLASS: Record<PlayheadTone, string> = {
  accent: styles.accent,
  contrast: styles.contrast,
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/**
 * Порт `design_ref/components/Playhead.dc.html` (atoms.json#Playhead).
 * Вертикальная риска-позиция на таймлайне/волне: оверлей поверх дорожки
 * (`Waveform`, клипы SFX), сам дорожку не рисует — только линию и, опционально,
 * флажок-держатель сверху. Ожидает `position: relative` у родителя.
 */
const Playhead = ({ position = 40, height = 48, tone = 'accent', withHandle = true }: PlayheadProps) => {
  const clampedPosition = clampPercent(position);
  const toneClass = TONE_CLASS[tone];

  return (
    <span className={styles.root} style={{ left: `${clampedPosition}%` }} aria-hidden="true">
      <span className={`${styles.line} ${toneClass}`} style={{ height: `${height}px` }} />
      {withHandle && <span className={`${styles.handle} ${toneClass}`} />}
    </span>
  );
};

export default Playhead;
