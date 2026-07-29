import React from 'react';

import styles from './Frame.module.css';

export type FrameTone = 'light' | 'dark' | 'accent' | 'blueprint-400' | 'blueprint-700';

export type FrameFill = 'none' | 'paper' | 'blueprint';

export interface FrameProps {
  tone?: FrameTone;
  selected?: boolean;
  /** Управляет фокусируемостью и hover/cursor-откликом рамки. */
  interactive?: boolean;
  padding?: number;
  /** Переопределяет горизонтальный отступ (влево/вправо), если задан отдельно от `padding`. */
  paddingX?: number;
  /** Переопределяет вертикальный отступ (вверх/вниз), если задан отдельно от `padding`. */
  paddingY?: number;
  /** Пунктирная рамка вместо сплошной — состояния running/locked, окно выбора и т.п. */
  dashed?: boolean;
  /** Заливка фона под рамкой; `none` — прозрачный фон, как было раньше. */
  fill?: FrameFill;
  /** display:block вместо инлайнового блока — рамка тянется на всю ширину контейнера. */
  block?: boolean;
  /** Делает рамку кликабельной кнопкой (`<button type="button">`); без колбэка рамка — обычный контейнер. */
  onClick?: () => void;
  children?: React.ReactNode;
}

const TONE_CLASS: Record<FrameTone, string> = {
  light: styles.light,
  dark: styles.dark,
  accent: styles.accent,
  'blueprint-400': styles.blueprint400,
  'blueprint-700': styles.blueprint700,
};

const FILL_CLASS: Record<FrameFill, string> = {
  none: '',
  paper: styles.fillPaper,
  blueprint: styles.fillBlueprint,
};

const paddingValue = (padding: number, paddingX?: number, paddingY?: number): string => {
  const y = paddingY ?? padding;
  const x = paddingX ?? padding;
  return y === x ? `${y}px` : `${y}px ${x}px`;
};

/**
 * Порт `design_ref/components/Frame.dc.html` (atoms.json#Frame).
 * Hairline-бордюр 1px — базовый контейнер-контур системы square-corner: пять
 * тонов рамки (три исходных плюс blueprint-400/700), сплошная или пунктирная
 * линия, опциональная заливка фона под рамкой, отметка выбора инсетом,
 * hover/focus для интерактивных мест и клик — либо `<button>`, либо просто
 * контейнер, если `onClick` не передан.
 */
const Frame = ({
  tone = 'light',
  selected = false,
  interactive = true,
  padding = 12,
  paddingX,
  paddingY,
  dashed = false,
  fill = 'none',
  block = false,
  onClick,
  children,
}: FrameProps) => {
  const className = [
    styles.root,
    TONE_CLASS[tone],
    FILL_CLASS[fill],
    selected ? styles.selected : '',
    interactive ? styles.interactive : '',
    dashed ? styles.dashed : '',
    block ? styles.block : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = { padding: paddingValue(padding, paddingX, paddingY) };

  if (onClick) {
    return (
      <button type="button" className={className} style={style} onClick={onClick} tabIndex={interactive ? 0 : -1}>
        {children}
      </button>
    );
  }

  return (
    <div className={className} style={style} tabIndex={interactive ? 0 : undefined}>
      {children}
    </div>
  );
};

export default Frame;
