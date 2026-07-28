import React, { useRef, useState } from 'react';

import styles from './ResizeHandle.module.css';

export type ResizeHandleOrientation = 'vertical' | 'horizontal';

export interface ResizeHandleProps {
  orientation?: ResizeHandleOrientation;
  /** Текущая доля первой панели, 15–85. Некотролируемый по умолчанию — не пере-задавать на каждый рендер. */
  split?: number;
  onResize?: (splitPct: number) => void;
}

const MIN = 15;
const MAX = 85;
const STEP = 2;

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n));

/**
 * Порт `design_ref/components/ResizeHandle.dc.html` (atoms.json#ResizeHandle).
 * 6px полоса между двумя панелями: тащит границу указателем (замеряя своего
 * родителя — общий бокс сплита) и двигает её стрелками с клавиатуры.
 */
const ResizeHandle = ({ orientation = 'vertical', split, onResize }: ResizeHandleProps) => {
  const [local, setLocal] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const vertical = orientation === 'vertical';

  const value = clamp(local ?? split ?? 50);

  const emit = (next: number) => {
    const clamped = clamp(next);
    setLocal(clamped);
    onResize?.(clamped);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const box = event.currentTarget.parentElement;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pct = vertical
      ? ((event.clientX - rect.left) / rect.width) * 100
      : ((event.clientY - rect.top) / rect.height) * 100;
    emit(Math.round(pct));
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const decreaseKey = vertical ? 'ArrowLeft' : 'ArrowUp';
    const increaseKey = vertical ? 'ArrowRight' : 'ArrowDown';
    let delta = 0;
    if (event.key === decreaseKey) delta = -STEP;
    if (event.key === increaseKey) delta = STEP;
    if (!delta) return;
    event.preventDefault();
    emit(value + delta);
  };

  const rootClass = [styles.root, vertical ? styles.vertical : styles.horizontal].filter(Boolean).join(' ');

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={value}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      tabIndex={0}
      className={rootClass}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  );
};

export default ResizeHandle;
