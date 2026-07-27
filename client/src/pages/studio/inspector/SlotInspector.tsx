import React from 'react';

import ActionButton from '@/ui/ActionButton';

import { useStudioStore } from '../studioStore';

import Section, { Field } from './Section';

import styles from '../panels/panels.module.css';

import type { ScoreModel } from '../derive/scoreModel';

export interface SlotInspectorProps {
  charId: string;
  slot: number;
  score: ScoreModel | null;
}

const STATE_LABEL: Record<string, string> = {
  loc: 'персонаж здесь, играть нечего',
  offscreen: 'персонаж за кадром',
  done: 'проза готова',
  open: 'сцена есть, прозы нет',
  locked: 'заперто выбранной веткой',
  failed: 'проверка не пройдена',
  empty: 'пусто',
};

/**
 * Инспектор слота: что движок увидит в этой точке времени. Список событий —
 * ровно те кандидаты, среди которых режиссёр будет выбирать сцену.
 */
const SlotInspector = ({ charId, slot, score }: SlotInspectorProps) => {
  const setViewportTab = useStudioStore(s => s.setViewportTab);

  const column = score?.columns.find(c => c.slot === slot) ?? null;
  const row = charId === '' ? null : score?.rows.find(r => r.charId === charId) ?? null;
  const cell = charId === '' ? score?.spine[slot] ?? null : row?.cells[slot] ?? null;
  const coverage = score?.coverage[slot] ?? null;

  // Кто ещё стоит в этой колонке — соседи по слоту, а не по локации: авторy
  // важно видеть, с кем герой вообще может пересечься.
  const others = (score?.rows ?? [])
    .filter(r => r.charId !== charId && r.cells[slot]?.locationId != null)
    .map(r => `${r.name} · ${r.cells[slot]?.text}`);

  return (
    <>
      <div>
        <div className={styles.kicker}>{charId === '' ? 'хребет' : row?.name ?? charId}</div>
        <h2 className={styles.title}>{column?.label ?? `слот ${slot}`}</h2>
        <div className={styles.chipRow} style={{ marginTop: 6 }}>
          {/* actOfSlot нумерует акты с единицы — сдвигать не нужно. */}
          <span className={styles.chip}>акт {column?.act ?? 1}</span>
          {cell && <span className={styles.chip}>{STATE_LABEL[cell.state] ?? cell.state}</span>}
        </div>
      </div>

      <Section title="Место">
        <Field name="локация">{cell?.locationId ?? '—'}</Field>
        <Field name="покрытие">{coverage ? `${coverage.glyph} ${coverage.tip}` : '—'}</Field>
        {others.length > 0 && <Field name="кто рядом">{others.join(' · ')}</Field>}
      </Section>

      <Section title={`Кандидаты · ${cell?.events.length ?? 0}`}>
        {(cell?.events.length ?? 0) === 0 && (
          <div className={styles.placeholder}>В этом слоте играть нечего: ни бита хребта, ни встречи.</div>
        )}
        {cell?.events.map(event => (
          <div key={`${event.kind}:${event.id}`} className={styles.field}>
            <span className={styles.fieldName}>{event.kind === 'beat' ? '◈ бит' : '› встреча'}</span>
            <span className={styles.fieldValue}>
              {event.title}
              <span className={styles.mono}>
                {' '}
                {event.failed ? '✗' : event.dimmed ? '⌁' : event.hasProse ? '✓' : '□'}
              </span>
            </span>
          </div>
        ))}
      </Section>

      <div className={styles.actions}>
        <ActionButton
          label="Показать в сценарии"
          kind="ghost"
          block
          disabled={(cell?.events.length ?? 0) === 0}
          reason="в слоте нет сцен"
          onClick={() => setViewportTab('script')}
        />
      </div>
    </>
  );
};

export default SlotInspector;
