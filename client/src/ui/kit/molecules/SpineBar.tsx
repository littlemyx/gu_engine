import React from 'react';

import TextLabel from '../atoms/TextLabel';

import styles from './SpineBar.module.css';

export type SpineBarState = 'fill' | 'window' | 'hatch' | 'anchor' | 'final';

export interface SpineBarProps {
  /** Подпись бита партитуры, напр. «Б2». */
  label: string;
  state?: SpineBarState;
  selected?: boolean;
  /** Пояснение рядом с окном прогресса, напр. «окно Д1в–Д2в». Осмыслено только у `window`. */
  note?: string;
  /** Начало непрозрачного участка окна, % (0–100). Осмыслено только у `window`. */
  fillStart?: number;
  /** Ширина непрозрачного участка окна, % (0–100). Осмыслено только у `window`. */
  fillWidth?: number;
  /** Ширина полосы, px. */
  width?: number;
  onClick?: () => void;
}

const STATE_CLASS: Record<SpineBarState, string> = {
  fill: styles.stateFill,
  window: styles.stateWindow,
  hatch: styles.stateHatch,
  anchor: styles.stateAnchor,
  final: styles.stateFinal,
};

const clampPercent = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Порт `design_ref/components/SpineBar.dc.html` (molecules.json#p021,
 * «ПОЛОСА БИТА ПАРТИТУРЫ»).
 * Бит хребта партитуры: `fill`/`anchor`/`final` — сплошной залитый блок с
 * белой подписью, `window` — рамка с окном прогресса поверх недописанного
 * бита и пояснением сбоку, `hatch` — заготовка ненаписанного бита.
 * Заявленные в реестре атомы (`ToneSurface`, `Frame`, `HatchFill`,
 * `SelectionHighlight`) фиксируют свои тона на конкретных токенах
 * (accent-100/900, gu-line/neutral, инсетный акцент), а этой полосе разом
 * нужны все пять акцентных ступеней макета — accent, accent-400, accent-200,
 * accent-700, accent-900 — под которые ни один из атомов не подставить без
 * правки самого атома; фон, рамка и кольцо выбора собраны локально.
 * `TextLabel` реален там, где текст реально белый на цветной подложке
 * (`onDark`); подпись окна и штриховки красится в свои акцентные тона
 * (`accent-700`/`accent-900`), которых у атома нет, — эти куски тоже локальные.
 */
const SpineBar = ({
  label,
  state = 'window',
  selected = false,
  note,
  fillStart = 0,
  fillWidth = 25,
  width = 140,
  onClick,
}: SpineBarProps) => {
  const isWindow = state === 'window';
  const isHatch = state === 'hatch';
  const isSolid = !isWindow && !isHatch;
  const interactive = Boolean(onClick);
  const solidLabel = (state === 'anchor' ? '◈ ' : '') + label;

  const rootClassName = [
    styles.root,
    STATE_CLASS[state],
    isSolid ? styles.solid : '',
    selected ? styles.selected : '',
    interactive ? styles.clickable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {isWindow && (
        <>
          <span
            className={styles.windowFill}
            style={{ left: `${clampPercent(fillStart)}%`, width: `${clampPercent(fillWidth)}%` }}
          >
            <TextLabel text={label} onDark size={9.5} />
          </span>
          {note && (
            <>
              {' '}
              <span className={styles.note}>{note}</span>
            </>
          )}
        </>
      )}
      {isHatch && <span className={styles.hatchLabel}>{label}</span>}
      {isSolid && (
        <span className={styles.solidLabel}>
          <TextLabel text={solidLabel} onDark size={9.5} />
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className={rootClassName} style={{ width: `${width}px` }}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" className={rootClassName} style={{ width: `${width}px` }} onClick={onClick}>
      {content}
    </button>
  );
};

export default SpineBar;
