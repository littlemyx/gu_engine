import React from 'react';

import MutedText from '../atoms/MutedText';
import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';

import styles from './CoverageRow.module.css';

export type CoverageCellTone = 'scene' | 'filler' | 'empty';

export interface CoverageCell {
  /** ● снятая сцена / ○ филлер / ⚠ пустой слот без событий. */
  tone: CoverageCellTone;
  /** Тултип ячейки — например «слот без событий». */
  tip?: string;
}

export interface CoverageRowProps {
  /** Подпись слева, напр. «Покрытие». */
  label: string;
  /** Ряд ячеек слева направо, по одной на слот. */
  cells: CoverageCell[];
  /** Ширина подписи, px. */
  labelWidth?: number;
  /** Ширина одной ячейки, px. */
  cellWidth?: number;
}

const CELL_STATUS: Record<'scene' | 'filler', StatusGlyphStatus> = {
  scene: 'fresh',
  filler: 'none',
};

/**
 * Порт `design_ref/components/CoverageRow.dc.html` (molecules.json#p024,
 * «СТРОКА ПОКРЫТИЯ»).
 * Полоса покрытия слотов: подпись слева и ряд ячеек-глифов справа — ● снятая
 * сцена, ○ филлер, ⚠ пустой слот. У исходника нет пропа `context` — строка
 * всегда живёт на светлой рабочей области (подпись в neutral-600, глиф сцены
 * в accent-700), поэтому `onDark` здесь не нужен. Тон «пусто» рисуется
 * локально, а не через `StatusGlyph.warn`: макет красит его ровно в
 * `#b96a6a` — это токен `--gu-signal-fail-line`, тогда как палитра `warn`
 * атома жёлто-коричневая (`--gu-signal-warn-deep`). Тона `scene`/`filler`
 * совпадают с `StatusGlyph.fresh`/`.none` один в один, поэтому там атом
 * переиспользован как есть.
 */
const CoverageRow = ({ label, cells, labelWidth = 88, cellWidth = 33 }: CoverageRowProps) => {
  return (
    <div className={styles.root}>
      <span className={styles.label} style={{ width: `${labelWidth}px` }}>
        <MutedText text={label} size={9.5} />
      </span>
      {cells.map((cell, index) => (
        <span key={index} className={styles.cell} style={{ width: `${cellWidth}px` }} title={cell.tip}>
          {cell.tone === 'empty' ? (
            <span className={styles.emptyGlyph} aria-hidden="true">
              ⚠
            </span>
          ) : (
            <StatusGlyph status={CELL_STATUS[cell.tone]} size={10} />
          )}
        </span>
      ))}
    </div>
  );
};

export default CoverageRow;
