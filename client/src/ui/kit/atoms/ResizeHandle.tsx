import React, { useCallback, useRef, useState } from 'react';

import styles from './ResizeHandle.module.css';

export type ResizeHandleOrientation = 'vertical' | 'horizontal';

/** Шаг стрелок из спеки 7h; Shift ускоряет втрое. */
export const NUDGE_STEP = 16;
export const NUDGE_STEP_FAST = 48;

export interface ResizeHandleProps {
  orientation?: ResizeHandleOrientation;
  /** Подпись для ассистивных технологий: «Ширина иерархии» и т.п. */
  label?: string;
  /** Текущий размер панели — только для aria; атом его не хранит и не считает. */
  valueNow?: number;
  className?: string;
  style?: React.CSSProperties;
  onDragStart?: () => void;
  /** Смещение указателя от точки нажатия вдоль оси ручки, в пикселях. */
  onDrag?: (deltaPx: number) => void;
  onDragEnd?: () => void;
  /** Стрелки: ±16px, с Shift ±48px. Знак — по оси, без учёта стороны панели. */
  onNudge?: (deltaPx: number) => void;
  /** Двойной клик — сброс к размеру по умолчанию. */
  onReset?: () => void;
}

/**
 * Порт `design_ref/components/ResizeHandle.dc.html` (atoms.json#ResizeHandle, фрейм 7h).
 *
 * Это ТОЛЬКО полоска, за которую волочат: вид, курсор, ховер, кольцо фокуса и
 * жесты. Размером панелей, их числом, порядком, лимитами и хранением ширин
 * заведует механизм раскладки — атом отдаёт наружу дельту в пикселях и ничего
 * не помнит между кадрами.
 */
const ResizeHandle = ({
  orientation = 'vertical',
  label,
  valueNow,
  className,
  style,
  onDragStart,
  onDrag,
  onDragEnd,
  onNudge,
  onReset,
}: ResizeHandleProps) => {
  const [active, setActive] = useState(false);
  const origin = useRef(0);
  const vertical = orientation === 'vertical';

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      // Захват указателя — оптимизация, а не условие работы: если браузер его
      // не даёт, перетаскивание всё равно должно начаться.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* указатель уже отпущен или не поддерживается */
      }
      origin.current = vertical ? event.clientX : event.clientY;
      setActive(true);
      onDragStart?.();
    },
    [onDragStart, vertical],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!active) return;
      onDrag?.((vertical ? event.clientX : event.clientY) - origin.current);
    },
    [active, onDrag, vertical],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!active) return;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        /* захвата не было */
      }
      setActive(false);
      onDragEnd?.();
    },
    [active, onDragEnd],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const back = vertical ? 'ArrowLeft' : 'ArrowUp';
      const forward = vertical ? 'ArrowRight' : 'ArrowDown';
      const step = event.shiftKey ? NUDGE_STEP_FAST : NUDGE_STEP;
      if (event.key === back) onNudge?.(-step);
      else if (event.key === forward) onNudge?.(step);
      else return;
      event.preventDefault();
    },
    [onNudge, vertical],
  );

  const rootClass = [
    styles.root,
    vertical ? styles.vertical : styles.horizontal,
    active ? styles.active : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={valueNow === undefined ? undefined : Math.round(valueNow)}
      tabIndex={0}
      className={rootClass}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
    />
  );
};

export default ResizeHandle;
