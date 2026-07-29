import React from 'react';

import Divider from '../atoms/Divider';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './CostTable.module.css';

export interface CostTableRow {
  /** Что оценивается: «план (хребет + каст + мир)», «диалоги + проза · 21 слот». */
  label: string;
  /** Смета строки, обычно `≈ $0.NN`. */
  value: string;
}

export interface CostTableProps {
  rows: CostTableRow[];
  /** Итоговая строка под чертой. Без неё черта и итог не рендерятся. */
  total?: CostTableRow;
  /** Таблица стоит на тёмном хроме инспектора — умолчание макета. */
  onDark?: boolean;
  /** Ширина обёртки, px. */
  width?: number;
}

const WRAP_PAD_X = 14;

/**
 * Порт `design_ref/components/CostTable.dc.html` (molecules.json#p017).
 * Смета операции (сцены, слоты, медиа) построчно и, опционально, итог под
 * чертой — карточка сметы перед прогоном партии.
 */
const CostTable = ({ rows, total, onDark = true, width = 290 }: CostTableProps) => {
  const rootClass = [styles.root, onDark ? styles.onDark : styles.onLight].join(' ');
  const ruleLength = Math.max(width - (onDark ? WRAP_PAD_X * 2 : 0), 0);

  return (
    <div className={rootClass} style={{ width: `${width}px` }}>
      <div className={styles.grid}>
        {rows.map((row, index) => (
          <React.Fragment key={`${row.label}-${index}`}>
            <span className={styles.label}>
              <MutedText text={row.label} onDark={onDark} size={11} />
            </span>
            <span className={styles.value}>
              <MonoText text={row.value} onDark={onDark} size={11} />
            </span>
          </React.Fragment>
        ))}
        {total && (
          <>
            <span className={styles.rule}>
              <Divider orientation="horizontal" onDark={onDark} length={ruleLength} />
            </span>
            <span className={styles.totalLabel}>
              <TextLabel text={total.label} onDark={onDark} size={11} />
            </span>
            <span className={[styles.totalValue, onDark ? styles.totalValueOnDark : ''].filter(Boolean).join(' ')}>
              {total.value}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default CostTable;
