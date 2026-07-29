import React, { useCallback, useRef } from 'react';

import ResizeHandle from '@/ui/kit/atoms/ResizeHandle';

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
 * Механизм рамки между панелями: с какой стороны растёт панель, какой у неё
 * размер в пикселях и где рамка стоит. Полоску, за которую волочат, рисует
 * атом кита — рамок в шелле сколько угодно и в любом порядке, потому что
 * каждая знает только про свою панель.
 *
 * Размер держит вызывающая сторона (стор шелла): рамка полностью
 * контролируемая и между кадрами помнит лишь размер на момент нажатия.
 */
const PanelResizer = ({ axis, size, invert = false, label, style, onResize, onReset }: PanelResizerProps) => {
  // Дельта от атома отсчитывается от точки нажатия, а не от предыдущего
  // кадра, поэтому складывать её надо с размером на начало перетаскивания.
  const base = useRef(size);

  const apply = useCallback((delta: number) => onResize(base.current + (invert ? -delta : delta)), [invert, onResize]);

  const onNudge = useCallback(
    (delta: number) => {
      // Клавиатура двигает от текущего размера: перетаскивания нет, начальной
      // точки тоже.
      base.current = size;
      apply(delta);
    },
    [apply, size],
  );

  return (
    <ResizeHandle
      orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      label={label}
      valueNow={size}
      className={axis === 'x' ? styles.vertical : styles.horizontal}
      style={style}
      onDragStart={() => {
        base.current = size;
      }}
      onDrag={apply}
      onNudge={onNudge}
      onReset={onReset}
    />
  );
};

export default PanelResizer;
