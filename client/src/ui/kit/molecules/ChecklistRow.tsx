import React from 'react';

import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';
import TextLabel from '../atoms/TextLabel';
import MutedText from '../atoms/MutedText';

import styles from './ChecklistRow.module.css';

export type ChecklistRowState = 'ready' | 'warning' | 'problem' | 'pending';

export interface ChecklistRowProps {
  /** Заголовок пункта: «мир», «спайн», «каст-план», … */
  title: string;
  /** Пояснительная строка справа: «университет · bittersweet · 3 темы». */
  meta: string;
  state?: ChecklistRowState;
  onDark?: boolean;
}

/** У StatusGlyph свой алфавит — маппим состояние чек-листа на его статус. */
const GLYPH_STATUS: Record<ChecklistRowState, StatusGlyphStatus> = {
  ready: 'ok',
  warning: 'warn',
  problem: 'fail',
  pending: 'none',
};

/**
 * Порт `design_ref/components/ChecklistRow.dc.html` (molecules.json#p016).
 * Строка чек-листа готовности: глиф-статус, заголовок и приглушённая мета в
 * одну строку с обрезкой по ширине. В макете живёт на тёмном хроме по
 * умолчанию (панель готовности), но умеет и светлый контекст.
 */
const ChecklistRow = ({ title, meta, state = 'ready', onDark = true }: ChecklistRowProps) => {
  return (
    <div className={[styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ')}>
      <span className={styles.glyph}>
        <StatusGlyph status={GLYPH_STATUS[state]} onDark={onDark} size={11} />
      </span>
      <span className={styles.title}>
        <TextLabel text={title} onDark={onDark} bold size={11} />
      </span>
      <span className={styles.meta}>
        <MutedText text={meta} onDark={onDark} size={11} />
      </span>
    </div>
  );
};

export default ChecklistRow;
