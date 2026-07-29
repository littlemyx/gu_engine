import React from 'react';

import styles from './HatchFill.module.css';

/** Тон штриховки: `neutral` — нейтральные/тёмные токены (как раньше), `accent` — заливка accent-200, рамка accent-700. */
export type HatchFillTone = 'neutral' | 'accent';

export interface HatchFillProps {
  /** Ширина одной диагональной полосы, px (4–28). Дефолт зависит от `onDark`. */
  step?: number;
  /** Подпись-заглушка, когда содержимого нет; пустая строка её прячет. */
  note?: string;
  onDark?: boolean;
  /** Тон штриховки и рамки. По умолчанию `neutral` — прежнее поведение без изменений. */
  tone?: HatchFillTone;
  children?: React.ReactNode;
}

const TONE_CLASS: Record<HatchFillTone, string> = {
  neutral: '',
  accent: styles.toneAccent,
};

/**
 * Порт `design_ref/components/HatchFill.dc.html` (atoms.json#HatchFill).
 * Штриховка 45° — заглушка незаполненного места: пустой слот сцены, ещё не
 * взятый тейк спрайта. Без содержимого показывает подпись-note, с ним — сам
 * контент поверх штриховки. Тон `accent` (заливка accent-200, рамка
 * accent-700) добавлен по запросу `SpineBar` — состояние «hatch» бита
 * партитуры до этого собирало ту же штриховку локальным CSS в молекуле.
 */
const HatchFill = ({ step, note = 'прозы нет', onDark = false, tone = 'neutral', children }: HatchFillProps) => {
  const resolvedStep = step ?? (onDark ? 14 : 8);
  const rootClass = [styles.root, onDark ? styles.onDark : '', TONE_CLASS[tone]].filter(Boolean).join(' ');
  const hasChildren = children !== undefined && children !== null && children !== false;
  const showNote = !hasChildren && note !== '';

  return (
    <div className={rootClass} style={{ '--hf-step': `${resolvedStep}px` } as React.CSSProperties}>
      {hasChildren ? children : null}
      {showNote ? <span className={styles.note}>{note}</span> : null}
    </div>
  );
};

export default HatchFill;
