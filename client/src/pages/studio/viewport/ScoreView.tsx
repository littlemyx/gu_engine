import React from 'react';

import SlotCell from '@/ui/SlotCell';

import { isSameSelection, useStudioStore } from '../studioStore';

import styles from './viewport.module.css';

import type { ScoreModel } from '../derive/scoreModel';

export interface ScoreViewProps {
  model: ScoreModel;
}

/**
 * «Партитура»: колонка — слот календаря, строка — хребет, персонаж или
 * покрытие. Всё, что можно узнать о клетке, показывает инспектор слота —
 * в сетке остаются только заливка и код локации.
 */
const ScoreView = ({ model }: ScoreViewProps) => {
  const selection = useStudioStore(s => s.selection);
  const select = useStudioStore(s => s.select);

  const selectedSlot = selection?.kind === 'slot' ? selection.slot : null;
  const gridTemplate = `88px repeat(${model.columns.length}, var(--gu-slot-width))`;

  // Шапка дней: подпись растягивается на все части одного дня.
  const days: Array<{ day: number; span: number; act: number }> = [];
  for (const column of model.columns) {
    const last = days[days.length - 1];
    if (last && last.day === column.day) last.span += 1;
    else days.push({ day: column.day, span: 1, act: column.act });
  }

  return (
    <div className={styles.scoreRoot}>
      <div className={styles.scoreLegend}>
        <span>■ проза готова · □ прозы нет · ▨ упало · пунктир — заперто веткой</span>
        <span>● сцены · ○ проза не дописана · ⚠ пусто</span>
      </div>

      <div className={styles.scoreScroll}>
        <div className={styles.scoreGrid} style={{ gridTemplateColumns: gridTemplate }}>
          <div className={styles.scoreCorner} />
          {days.map(({ day, span }) => (
            <div key={day} className={styles.scoreDay} style={{ gridColumn: `span ${span}` }}>
              День {day}
            </div>
          ))}

          <div className={styles.scoreCorner} />
          {model.columns.map(column => (
            <button
              key={column.slot}
              type="button"
              className={`${styles.scorePart} ${selectedSlot === column.slot ? styles.scorePartActive : ''}`}
              title={column.label}
              onClick={() => select({ kind: 'slot', charId: '', slot: column.slot })}
            >
              {column.short.slice(0, 3)}
            </button>
          ))}

          <div className={styles.scoreRowHead}>Хребет</div>
          {model.spine.map(cell => (
            <div key={`spine-${cell.slot}`} className={styles.scoreCellBox}>
              <SlotCell
                text={cell.text}
                state={cell.state}
                tip={cell.tip}
                selected={selectedSlot === cell.slot && selection?.kind === 'slot' && selection.charId === ''}
                onClick={() => select({ kind: 'slot', charId: '', slot: cell.slot })}
              />
            </div>
          ))}

          {model.rows.map(row => (
            <React.Fragment key={row.charId}>
              <button
                type="button"
                className={styles.scoreRowHeadButton}
                onClick={() => select({ kind: 'character', id: row.charId })}
                title={`${row.name} · событий в ${row.eventCount} слотах`}
              >
                <span className={styles.scoreRowDot} style={{ background: row.color }} />
                {row.name}
              </button>
              {row.cells.map(cell => (
                <div key={`${row.charId}-${cell.slot}`} className={styles.scoreCellBox}>
                  <SlotCell
                    text={cell.text}
                    state={cell.state}
                    tip={cell.tip}
                    selected={isSameSelection(selection, { kind: 'slot', charId: row.charId, slot: cell.slot })}
                    onClick={() => select({ kind: 'slot', charId: row.charId, slot: cell.slot })}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}

          <div className={styles.scoreRowHead}>Покрытие</div>
          {model.coverage.map(cell => (
            <div key={`cov-${cell.slot}`} className={styles.scoreCoverage} title={cell.tip}>
              {cell.glyph}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.scoreCodes}>
        {model.locationCodes.map(({ code, name }) => (
          <span key={code}>
            <b>{code}</b> {name}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ScoreView;
