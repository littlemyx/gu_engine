import React from 'react';

import Counter from '../atoms/Counter';
import Glyph from '../atoms/Glyph';

import styles from './TakeChips.module.css';

export type TakeChipStatus = 'normal' | 'compared' | 'accepted';

export interface TakeChipItem {
  /** Метка тейка, например «№1». */
  label: string;
  /** Счётчик рядом с меткой, моноширинным — печатается как «#N». */
  count?: string;
  status?: TakeChipStatus;
}

export interface TakeChipsProps {
  /** Ряд фишек тейков слева направо. */
  items: TakeChipItem[];
  onDark?: boolean;
  /** Зовётся с индексом фишки; сама фишка выбор не хранит. */
  onPick?: (index: number) => void;
}

const STATUS_CLASS: Record<TakeChipStatus, string> = {
  normal: styles.normal,
  compared: styles.compared,
  accepted: styles.accepted,
};

const COUNTER_TONE: Record<TakeChipStatus, 'neutral' | 'accent'> = {
  normal: 'neutral',
  compared: 'accent',
  accepted: 'accent',
};

/**
 * Порт `design_ref/components/TakeChips.dc.html` (molecules.json#k102,
 * «ЧИПЫ ТЕЙКОВ · ОБЫЧНЫЙ / СРАВНИВАЕМЫЙ / ПРИНЯТ»). Ряд фишек-тейков сцены:
 * «обычный» — приглушённый контур, «сравниваемый» — акцентный контур для
 * текущего кандидата на сравнение, «принят» — двойная акцентная рамка и
 * галочка. Клик по любой фишке (в т.ч. уже принятой) сообщает индекс наверх.
 */
const TakeChips = ({ items, onDark = false, onPick }: TakeChipsProps) => {
  return (
    <div className={styles.root}>
      {items.map((item, index) => {
        const status = item.status ?? 'normal';
        const className = [styles.chip, STATUS_CLASS[status], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

        const content = (
          <>
            {status === 'accepted' && <Glyph glyph="✓" tone="accent" size={9} onDark={onDark} />}
            <span className={styles.label}>{item.label}</span>
            {item.count && <Counter value={`#${item.count}`} tone={COUNTER_TONE[status]} onDark={onDark} size={9} />}
          </>
        );

        if (!onPick) {
          return (
            <span key={`${index}-${item.label}`} className={className}>
              {content}
            </span>
          );
        }

        return (
          <button key={`${index}-${item.label}`} type="button" className={className} onClick={() => onPick(index)}>
            {content}
          </button>
        );
      })}
    </div>
  );
};

export default TakeChips;
