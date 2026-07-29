import React from 'react';

import Kicker from '../atoms/Kicker';

import styles from './TranscriptBar.module.css';

export type TranscriptChipTone = 'normal' | 'current' | 'warning';

export interface TranscriptChipItem {
  /** Подпись чипа, например «Д2д Кафе» или предупреждение о промотке. */
  label: string;
  tone?: TranscriptChipTone;
}

export interface TranscriptBarProps {
  /** Кикер слева от ленты; пустая строка прячет его. */
  label?: string;
  /** Лента чипов транскрипта слева направо. */
  items: TranscriptChipItem[];
  onDark?: boolean;
  /** Зовётся с индексом чипа; сам чип клика не хранит. */
  onPick?: (index: number) => void;
}

const TONE_PREFIX: Record<TranscriptChipTone, string> = {
  normal: '',
  current: '► ',
  warning: '⚠ ',
};

const TONE_CLASS: Record<TranscriptChipTone, string> = {
  normal: styles.normal,
  current: styles.current,
  warning: styles.warning,
};

/**
 * Порт `design_ref/components/TranscriptBar.dc.html` (molecules.json#s014,
 * «ПОЛОСА ТРАНСКРИПТА»). Полоса превью сценария: кикер-подсказка слева и
 * лента чипов сыгранных/текущих бит транскрипта. «Обычный» чип — приглушённый
 * контур, «текущий» — акцентная заливка с ►, «предупреждение» — пунктирный
 * контур с ⚠ (промотка остановлена дальше по истории). Клик по чипу
 * сообщает индекс наверх — это детерминированный откат к этой точке.
 *
 * Атом `TranscriptChip` (molecules.json#s014 dcRefs) в ките не портирован —
 * его вид собран локально в `TranscriptBar.module.css` на токенах кита.
 */
const TranscriptBar = ({
  label = 'ТРАНСКРИПТ · клик = детерминированный откат',
  items,
  onDark = false,
  onPick,
}: TranscriptBarProps) => {
  const rootClassName = [styles.root, onDark ? styles.barOnDark : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      {label && <Kicker text={label} tone="neutral" onDark={onDark} size={9} />}
      {items.map((item, index) => {
        const tone = item.tone ?? 'normal';
        const chipClassName = [styles.chip, TONE_CLASS[tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');
        const content = `${TONE_PREFIX[tone]}${item.label}`;

        if (!onPick) {
          return (
            <span key={`${index}-${item.label}`} className={chipClassName}>
              {content}
            </span>
          );
        }

        return (
          <button key={`${index}-${item.label}`} type="button" className={chipClassName} onClick={() => onPick(index)}>
            {content}
          </button>
        );
      })}
    </div>
  );
};

export default TranscriptBar;
