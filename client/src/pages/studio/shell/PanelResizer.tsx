import React, { useCallback, useRef, useState } from 'react';

import styles from './PanelResizer.module.css';

export interface PanelResizerProps {
  /** `x` — вертикальная рамка между колонками, `y` — горизонтальная над доком. */
  axis: 'x' | 'y';
  /** Текущий размер панели в пикселях. */
  size: number;
  /** Тянем к началу оси (левая панель) или к концу (правая/нижняя). */
  invert?: boolean;
  label: string;
  /** Где стоит рамка: left/right/top в пикселях внутри позиционированного родителя. */
  style?: React.CSSProperties;
  onResize: (size: number) => void;
  /** Двойной клик — вернуть размер по умолчанию. */
  onReset?: () => void;
}

/**
 * Рамка между панелями. Тянется указателем с захватом (pointer capture):
 * курсор может уехать за пределы полоски и даже за окно — перетаскивание
 * не рвётся, пока кнопка нажата. Клавиатура двигает рамку стрелками, потому
 * что мышь — не единственный способ работать с интерфейсом.
 */
const PanelResizer = ({ axis, size, invert = false, label, style, onResize, onReset }: PanelResizerProps) => {
  const [active, setActive] = useState(false);
  const origin = useRef({ pointer: 0, size: 0 });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      // Захват указателя — оптимизация, а не условие работы: если браузер его
      // не даёт, перетаскивание всё равно должно начаться.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* указатель уже отпущен или не поддерживается */
      }
      origin.current = { pointer: axis === 'x' ? event.clientX : event.clientY, size };
      setActive(true);
    },
    [axis, size],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!active) return;
      const current = axis === 'x' ? event.clientX : event.clientY;
      const delta = current - origin.current.pointer;
      onResize(origin.current.size + (invert ? -delta : delta));
    },
    [active, axis, invert, onResize],
  );

  const finish = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* захвата не было */
    }
    setActive(false);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // 16px за нажатие — как в макете 7h; Shift ускоряет втрое.
      const step = event.shiftKey ? 48 : 16;
      const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
      const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      if (event.key === back) onResize(size + (invert ? step : -step));
      else if (event.key === forward) onResize(size + (invert ? -step : step));
      else return;
      event.preventDefault();
    },
    [axis, invert, onResize, size],
  );

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(size)}
      tabIndex={0}
      className={`${axis === 'x' ? styles.vertical : styles.horizontal} ${active ? styles.active : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
};

export default PanelResizer;
