import React, { useState } from 'react';

import OutlineButton from '../atoms/OutlineButton';

import styles from './RunControls.module.css';

export interface RunControlsProps {
  /** Подпись кнопки-переключателя в состоянии «идёт прогон». */
  pauseLabel?: string;
  /** Подпись кнопки-переключателя в состоянии «на паузе». */
  resumeLabel?: string;
  /** Подпись кнопки остановки. */
  stopLabel?: string;
  /** Начальное состояние паузы. Неконтролируемый по умолчанию — не пере-задавать на каждый рендер. */
  paused?: boolean;
  onPause?: (paused: boolean) => void;
  onStop?: () => void;
}

/**
 * Порт `design_ref/components/RunControls.dc.html` (molecules.json#k045, «УПРАВЛЕНИЕ ПРОГОНОМ»).
 * Пара кнопок над идущим прогоном: пауза/продолжить переключает своё
 * состояние сама (как счётчик у `Stepper`) и уведомляет колбэком, стоп — чисто
 * внешнее действие через `OutlineButton`. Живёт только на тёмном хроме студии.
 */
const RunControls = ({
  pauseLabel = '⏸ Пауза на границе вызова',
  resumeLabel = '▶ Продолжить',
  stopLabel = '■ Стоп',
  paused,
  onPause,
  onStop,
}: RunControlsProps) => {
  const [local, setLocal] = useState<boolean | null>(null);
  const isPaused = local ?? paused ?? false;

  const togglePause = () => {
    const next = !isPaused;
    setLocal(next);
    onPause?.(next);
  };

  return (
    <div className={styles.root}>
      <button type="button" className={styles.toggle} onClick={togglePause}>
        {isPaused ? resumeLabel : pauseLabel}
      </button>
      <OutlineButton label={stopLabel} tone="neutral" size="compact" onDark onClick={onStop} />
    </div>
  );
};

export default RunControls;
