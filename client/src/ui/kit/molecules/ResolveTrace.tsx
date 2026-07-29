import React from 'react';

import AccentText from '../atoms/AccentText';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';

import styles from './ResolveTrace.module.css';

export interface ResolveTraceSegment {
  text: string;
  /** Разрешённый шаг: подсвечивается жирным акцентным моно вместо обычного. */
  accent?: boolean;
}

export interface ResolveTraceRow {
  segments: ResolveTraceSegment[];
}

export interface ResolveTraceProps {
  /** Строки трассы резолва: «нежно» → gentle, EMOTION_TO_POSE: gentle → *soft* и т.д. */
  rows: ResolveTraceRow[];
  /** Надзаголовок над трассой, например «Резолв эмоции → спрайт». */
  kicker?: string;
  /** Текст сработавшего фолбэка — если он есть, под трассой появляется рамка. */
  fallback?: string;
  /** Подпись перед текстом фолбэка. */
  fallbackLabel?: string;
  /** px, 240–700. */
  width?: number;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/ResolveTrace.dc.html` (molecules.json#p005).
 * Пошаговая трасса резолва (эмоция → поза → файл спрайта) в моноширинном
 * виде для QA; провалившийся шаг с фолбэком подсвечивается отдельной рамкой.
 */
const ResolveTrace = ({
  rows,
  kicker,
  fallback,
  fallbackLabel = 'fallback:',
  width = 340,
  onDark = false,
}: ResolveTraceProps) => {
  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      {kicker && (
        <div className={[styles.kicker, onDark ? styles.kickerOnDark : ''].filter(Boolean).join(' ')}>{kicker}</div>
      )}
      <div className={styles.body}>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.row}>
            {row.segments.map((seg, segIndex) =>
              seg.accent ? (
                <span
                  key={segIndex}
                  className={[styles.accentSeg, onDark ? styles.accentSegOnDark : ''].filter(Boolean).join(' ')}
                >
                  {seg.text}
                </span>
              ) : (
                <MonoText key={segIndex} text={seg.text} onDark={onDark} />
              ),
            )}
          </div>
        ))}
      </div>
      {fallback && (
        <div className={[styles.fallback, onDark ? styles.fallbackOnDark : ''].filter(Boolean).join(' ')}>
          <AccentText text={fallbackLabel} tone="error" bold size={10} onDark={onDark} />{' '}
          <MutedText text={fallback} size={10} onDark={onDark} />
        </div>
      )}
    </div>
  );
};

export default ResolveTrace;
