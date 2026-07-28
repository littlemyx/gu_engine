import React, { useRef, useState } from 'react';

import styles from './Slider.module.css';

export type SliderSize = 'regular' | 'mini';

export interface SliderProps {
  /** Подпись слева от значения: «вес», «громкость». */
  label: string;
  /** Текущее значение 0–100. Некотролируемый по умолчанию — не пере-задавать на каждый рендер. */
  value?: number;
  onChange?: (value: number) => void;
  size?: SliderSize;
  onDark?: boolean;
  disabled?: boolean;
  /** Строка «подпись — значение» над треком. */
  showLabel?: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Порт `design_ref/components/Slider.dc.html` (atoms.json#Slider).
 * Полоса-трек с прямоугольным thumb для весов и громкости: перетаскивание
 * указателем и стрелки клавиатуры (Shift — шаг ×10) двигают значение 0–100.
 */
const Slider = ({
  label,
  value,
  onChange,
  size = 'regular',
  onDark = false,
  disabled = false,
  showLabel = true,
}: SliderProps) => {
  const [local, setLocal] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const val = clamp(local ?? value ?? 50);

  const commit = (next: number) => {
    const clamped = clamp(next);
    setLocal(clamped);
    onChange?.(clamped);
  };

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    commit(Math.round(((clientX - rect.left) / rect.width) * 100));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !draggingRef.current) return;
    setFromClientX(e.clientX);
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let delta = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1;
    if (!delta) return;
    e.preventDefault();
    commit(val + delta * (e.shiftKey ? 10 : 1));
  };

  const rootClass = [
    styles.root,
    size === 'mini' ? styles.mini : styles.regular,
    onDark ? styles.onDark : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      {showLabel && (
        <div className={styles.header}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{val}</span>
        </div>
      )}
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={val}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.fill} style={{ width: `${val}%` }} />
        <span className={styles.thumb} style={{ left: `${val}%` }} aria-hidden="true" />
      </div>
    </div>
  );
};

export default Slider;
