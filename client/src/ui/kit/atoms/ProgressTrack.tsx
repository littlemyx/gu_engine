import React from 'react';

import styles from './ProgressTrack.module.css';

export type ProgressTrackSize = 'thin' | 'toolbar';
export type ProgressTrackTone = 'loading' | 'error';

export interface ProgressTrackProps {
  /** 0–100, автоматически зажимается в диапазон. */
  value: number;
  /** Заголовок над полосой; печатается, только если `showLabel`. */
  label?: string;
  /** Скрыть строку с подписью и числовым значением, оставить одну полосу. */
  showLabel?: boolean;
  /** Позиция метки-лимита, 0–100. 0 или не задано — метки нет. */
  limit?: number;
  size?: ProgressTrackSize;
  tone?: ProgressTrackTone;
  onDark?: boolean;
}

const SIZE_CLASS: Record<ProgressTrackSize, string> = {
  thin: styles.thin,
  toolbar: styles.toolbar,
};

const TONE_CLASS: Record<ProgressTrackTone, string> = {
  loading: '',
  error: styles.error,
};

const clampPercent = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Порт `design_ref/components/ProgressTrack.dc.html` (atoms.json#ProgressTrack).
 * Hairline-рамка с accent-заливкой прогресса; тулбарная толще, метка-лимит —
 * вертикальная риска на треке, ошибка красит заливку в сигнальный тон.
 */
const ProgressTrack = ({
  value,
  label,
  showLabel = true,
  limit = 0,
  size = 'thin',
  tone = 'loading',
  onDark = false,
}: ProgressTrackProps) => {
  const clampedValue = clampPercent(value);
  const hasLimit = limit > 0;
  const clampedLimit = clampPercent(limit);

  const rootClass = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const trackClass = [styles.track, SIZE_CLASS[size]].filter(Boolean).join(' ');
  const fillClass = [styles.fill, TONE_CLASS[tone]].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {showLabel && (
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{clampedValue}%</span>
        </div>
      )}
      <div className={trackClass} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clampedValue}>
        <div className={fillClass} style={{ width: `${clampedValue}%` }} />
        {hasLimit && <span className={styles.limitMark} style={{ left: `${clampedLimit}%` }} aria-hidden="true" />}
      </div>
    </div>
  );
};

export default ProgressTrack;
