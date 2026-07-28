import React from 'react';

import Counter, { type CounterTone } from '../atoms/Counter';
import Glyph, { type GlyphTone } from '../atoms/Glyph';
import IndentSpacer from '../atoms/IndentSpacer';
import SelectionHighlight from '../atoms/SelectionHighlight';

import styles from './HierarchyRow.module.css';

export type HierarchyRowState = 'normal' | 'selected' | 'failed' | 'running' | 'dim';

export interface HierarchyRowProps {
  /** Подпись строки: «порция 2 · ступень 2 · Кира». */
  label: string;
  /** Счётчик справа, напр. «4/9». Пусто — счётчик не рисуется. */
  meta?: string;
  /** Ведущий символ-иконка перед подписью. */
  icon?: string;
  /** Ступень вложенности строки в дереве, 0–3. */
  depth?: number;
  state?: HierarchyRowState;
  onClick?: () => void;
}

const GLYPH_TONE: Record<HierarchyRowState, GlyphTone> = {
  normal: 'muted',
  selected: 'muted',
  dim: 'muted',
  failed: 'error',
  running: 'info',
};

const COUNTER_TONE: Record<HierarchyRowState, CounterTone> = {
  normal: 'neutral',
  selected: 'neutral',
  dim: 'neutral',
  failed: 'error',
  running: 'accent',
};

const LABEL_STATE_CLASS: Record<HierarchyRowState, string> = {
  normal: '',
  selected: styles.labelSelected,
  dim: styles.labelDim,
  failed: '',
  running: '',
};

/**
 * Порт `design_ref/components/HierarchyRow.dc.html` (molecules.json#k047,
 * «СТРОКА ИЕРАРХИИ»).
 * Строка дерева иерархии (порция · ступень · слот): иконка, подпись и
 * счётчик, отступ по глубине вложенности и пять состояний прогона — обычная /
 * выбранная / ошибка / идёт / приглушённая. У исходника нет пропа `context` —
 * строка всегда живёт на тёмном хроме панели иерархии, поэтому `onDark` здесь
 * не нужен (тот же вывод, что в `ArtifactRow`). Подпись собрана локально, а не
 * атомом `TextLabel`: его единственный тон `onDark` даёт лишь `--gu-ink-85`,
 * а нужны ещё «выбрано» (`--gu-ink`, жирным) и «приглушено» (`--gu-ink-50`) —
 * оба токена точные, поэтому растягивать атом под них смысла нет.
 */
const HierarchyRow = ({ label, meta = '', icon = '·', depth = 0, state = 'normal', onClick }: HierarchyRowProps) => {
  const selected = state === 'selected';
  const running = state === 'running';
  const interactive = Boolean(onClick);

  const content = (
    <>
      <IndentSpacer level={Math.max(0, depth)} step={13} />
      <span className={running ? styles.iconSpin : styles.iconSlot}>
        <Glyph glyph={icon} tone={GLYPH_TONE[state]} onDark size={10} />
      </span>
      <span className={[styles.label, LABEL_STATE_CLASS[state]].filter(Boolean).join(' ')}>{label}</span>
      {meta && (
        <span className={styles.metaSlot}>
          <Counter value={meta} tone={COUNTER_TONE[state]} onDark size={10} />
        </span>
      )}
    </>
  );

  const rowClassName = [
    styles.root,
    interactive ? styles.clickable : '',
    interactive && !selected ? styles.hoverable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const row = interactive ? (
    <button type="button" className={rowClassName} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={rowClassName}>{content}</div>
  );

  if (!selected) return row;

  return (
    <SelectionHighlight variant="row" onDark padding={0}>
      {row}
    </SelectionHighlight>
  );
};

export default HierarchyRow;
