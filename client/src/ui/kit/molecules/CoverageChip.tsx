import React from 'react';

import Counter, { type CounterTone } from '../atoms/Counter';
import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';

import styles from './CoverageChip.module.css';

export type CoverageChipState = 'ok' | 'warn' | 'error';

export interface CoverageChipProps {
  /** Подпись покрытия: «4 юнита» и т.п. */
  label: string;
  state?: CoverageChipState;
  onDark?: boolean;
}

const STATE_CLASS: Record<CoverageChipState, string> = {
  ok: styles.ok,
  warn: styles.warn,
  error: styles.error,
};

const GLYPH_STATUS: Record<CoverageChipState, StatusGlyphStatus> = {
  ok: 'ok',
  warn: 'warn',
  error: 'fail',
};

const COUNTER_TONE: Record<CoverageChipState, CounterTone> = {
  ok: 'accent',
  warn: 'warn',
  error: 'error',
};

/**
 * Порт `design_ref/components/CoverageChip.dc.html` (molecules.json#p027, «ЧИП ПОКРЫТИЯ БРЕКЕТА»).
 * Индикатор покрытия сцен в брекете: глиф статуса (StatusGlyph) + счётчик-подпись
 * (Counter) внутри рамки; цвет рамки кодирует состояние — ок / предупреждение / ошибка.
 */
const CoverageChip = ({ label, state = 'ok', onDark = false }: CoverageChipProps) => {
  const className = [styles.root, STATE_CLASS[state], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span className={className}>
      <StatusGlyph status={GLYPH_STATUS[state]} onDark={onDark} size={10} spin={false} />
      <Counter value={label} tone={COUNTER_TONE[state]} onDark={onDark} size={10.5} />
    </span>
  );
};

export default CoverageChip;
