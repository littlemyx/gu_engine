import React from 'react';

import Heading from '../atoms/Heading';

import styles from './MapNode.module.css';

/**
 * Порт `design_ref/components/MapNode.dc.html` (molecules.json#p029,
 * «УЗЕЛ КАРТЫ МИРА»).
 * Карточка узла на карте мира: имя объекта, строка метаданных (озвучка,
 * готовность фона, счёт сцен) и рамка, кодирующая состояние генерации —
 * обычное, выбранное, в очереди или сбойное. Кликабельная только когда
 * передан `onClick`.
 */

export type MapNodeState = 'default' | 'selected' | 'queued' | 'error';

export interface MapNodeProps {
  /** Имя объекта карты — локации, персонажа. */
  name: string;
  /** Строка метаданных под именем, например «♪ уютный · фон ✓ · сцен 12». */
  meta: string;
  state?: MapNodeState;
  /** Ширина карточки, px. В макете диапазон 120–240, по умолчанию 150. */
  width?: number;
  onClick?: () => void;
}

const STATE_CLASS: Record<MapNodeState, string> = {
  default: styles.default,
  selected: styles.selected,
  queued: styles.queued,
  error: styles.error,
};

const EMPHASIS_STATES: ReadonlySet<MapNodeState> = new Set(['queued', 'error']);

const MapNode = ({ name, meta, state = 'default', width = 150, onClick }: MapNodeProps) => {
  const rootClassName = [styles.root, STATE_CLASS[state], onClick ? styles.interactive : ''].filter(Boolean).join(' ');
  const metaClassName = [styles.meta, EMPHASIS_STATES.has(state) ? styles.metaEmphasis : ''].filter(Boolean).join(' ');
  const style: React.CSSProperties = { width: `${width}px` };

  const content = (
    <>
      <Heading text={name} level="card" size={12} uppercase={false} />
      <div className={metaClassName}>{meta}</div>
    </>
  );

  if (!onClick) {
    return (
      <div className={rootClassName} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" className={rootClassName} style={style} onClick={onClick}>
      {content}
    </button>
  );
};

export default MapNode;
