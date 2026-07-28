import React from 'react';

import styles from './HatchFill.module.css';

export interface HatchFillProps {
  /** Ширина одной диагональной полосы, px (4–28). Дефолт зависит от `onDark`. */
  step?: number;
  /** Подпись-заглушка, когда содержимого нет; пустая строка её прячет. */
  note?: string;
  onDark?: boolean;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/HatchFill.dc.html` (atoms.json#HatchFill).
 * Штриховка 45° — заглушка незаполненного места: пустой слот сцены, ещё не
 * взятый тейк спрайта. Без содержимого показывает подпись-note, с ним — сам
 * контент поверх штриховки.
 */
const HatchFill = ({ step, note = 'прозы нет', onDark = false, children }: HatchFillProps) => {
  const resolvedStep = step ?? (onDark ? 14 : 8);
  const rootClass = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
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
