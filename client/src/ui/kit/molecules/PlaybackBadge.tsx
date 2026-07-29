import React from 'react';

import AccentText from '../atoms/AccentText';
import Cursor from '../atoms/Cursor';
import Timecode from '../atoms/Timecode';

import styles from './PlaybackBadge.module.css';

export interface PlaybackBadgeProps {
  /** Подпись бейджа; по умолчанию — «играет в миксе» на ходу и «пауза» на стопе. */
  label?: string;
  /** Текущая позиция, например `0:34`. */
  time?: string;
  /** Общая длительность, например `1:48`. */
  total?: string;
  /** Состояние воспроизведения: играет или на паузе. */
  playing?: boolean;
}

/**
 * Порт `design_ref/components/PlaybackBadge.dc.html` (molecules.json#k083).
 * Плашка статуса плеера в тёмном миксе: мигающий маркер и подпись
 * «играет в миксе · 0:34 / 1:48» на ходу, статичная пауза на стопе.
 */
const PlaybackBadge = ({ label, time = '0:34', total = '1:48', playing = true }: PlaybackBadgeProps) => {
  const resolvedLabel = label ?? (playing ? 'играет в миксе' : 'пауза');

  return (
    <span className={[styles.root, playing ? styles.playing : styles.paused].join(' ')}>
      {playing ? (
        <Cursor tone="accent" onDark blink size={9.5} />
      ) : (
        <span className={styles.pauseGlyph} aria-hidden="true">
          ⏸
        </span>
      )}
      <span className={styles.text}>
        {playing ? (
          <AccentText text={resolvedLabel} tone="accent" onDark bold size={9.5} />
        ) : (
          <span className={styles.pausedLabel}>{resolvedLabel}</span>
        )}
        <span className={styles.separator}> · </span>
        <Timecode value={`${time} / ${total}`} onDark muted size={9.5} />
      </span>
    </span>
  );
};

export default PlaybackBadge;
