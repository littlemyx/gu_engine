import React, { useState } from 'react';

import CheckGlyph from '../atoms/CheckGlyph';
import Glyph from '../atoms/Glyph';
import OutlineButton from '../atoms/OutlineButton';
import Timecode from '../atoms/Timecode';
import ToneSurface from '../atoms/ToneSurface';

import styles from './TransportBar.module.css';

export interface TransportBarProps {
  /** Подпись переключателя во время воспроизведения. */
  pauseLabel?: string;
  /** Подпись переключателя на паузе. */
  resumeLabel?: string;
  /** Подпись кнопки остановки, вместе с глифом. */
  stopLabel?: string;
  /** Подпись кнопки перемотки к началу слота, вместе с глифом. */
  restartLabel?: string;
  /** Подпись переключателя лупа. */
  loopLabel?: string;
  /** Текущая позиция, например `0:34`. */
  time?: string;
  /** Общая длительность слота, например `1:48`. */
  total?: string;
  /** Начальное состояние воспроизведения. Неконтролируемый по умолчанию — не пере-задавать на каждый рендер. */
  playing?: boolean;
  /** Начальное состояние лупа. */
  loop?: boolean;
  onPause?: (playing: boolean) => void;
  onStop?: () => void;
  onRestart?: () => void;
  onLoop?: (loop: boolean) => void;
}

/**
 * Порт `design_ref/components/TransportBar.dc.html` (molecules.json#k077, «ТРАНСПОРТ-БАР»).
 * Полоса управления просмотром слота партитуры: пауза/продолжить и луп
 * переключают своё состояние сами и уведомляют колбэком (как `RunControls`),
 * стоп и перемотка к началу слота — чисто внешние действия через `OutlineButton`.
 * Живёт на светлой рабочей области, поэтому фон плашки — бумага, а не хром.
 */
const TransportBar = ({
  pauseLabel = 'Пауза',
  resumeLabel = 'Продолжить',
  stopLabel = '■ Стоп',
  restartLabel = '⟲ С начала слота',
  loopLabel = 'луп слота',
  time = '0:34',
  total = '1:48',
  playing,
  loop,
  onPause,
  onStop,
  onRestart,
  onLoop,
}: TransportBarProps) => {
  const [localPlaying, setLocalPlaying] = useState<boolean | null>(null);
  const isPlaying = localPlaying ?? playing ?? true;
  const togglePlay = () => {
    const next = !isPlaying;
    setLocalPlaying(next);
    onPause?.(next);
  };

  const [localLoop, setLocalLoop] = useState<boolean | null>(null);
  const isLoop = localLoop ?? loop ?? true;
  const toggleLoop = () => {
    const next = !isLoop;
    setLocalLoop(next);
    onLoop?.(next);
  };

  return (
    <div className={styles.root}>
      <ToneSurface tone="run" padding={0}>
        <button type="button" className={styles.playButton} onClick={togglePlay}>
          <Glyph glyph={isPlaying ? '⏸' : '▶'} tone="accent" size={11} />
          {isPlaying ? pauseLabel : resumeLabel}
        </button>
      </ToneSurface>

      <OutlineButton label={stopLabel} size="compact" onClick={onStop} />
      <OutlineButton label={restartLabel} size="compact" onClick={onRestart} />

      <span className={styles.time}>
        <Timecode value={`${time} / ${total}`} size={10.5} />
      </span>

      <button type="button" className={styles.loop} aria-pressed={isLoop} onClick={toggleLoop}>
        {loopLabel}
        <CheckGlyph tone={isLoop ? 'ok' : 'muted'} size={11} />
      </button>
    </div>
  );
};

export default TransportBar;
