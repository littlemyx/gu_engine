import React from 'react';

import BigDigit, { type BigDigitTone } from '../atoms/BigDigit';
import MutedText from '../atoms/MutedText';

import styles from './KpiBlock.module.css';

export interface KpiBlockItem {
  /** Само число/итог, строкой — так проще нести ведущие нули и диапазоны. */
  value: string;
  /** Подпись под цифрой: «блокера», «заметки». */
  label: string;
  /** Тон цифры — смысловой: обычный счёт / приглушённая деталь / акцентный вывод. */
  tone?: BigDigitTone;
}

export interface KpiBlockProps {
  /** Пункты итога, в порядке отображения. */
  items: KpiBlockItem[];
  /** Кегль цифры, px (16–34 в макете), общий для всех пунктов блока. */
  size?: number;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/KpiBlock.dc.html` (molecules.json#k088, «БЛОК ИТОГА · KPI»).
 * Строка из нескольких KPI-пунктов: крупная цифра сверху, приглушённая подпись
 * под ней. Собран целиком из атомов `BigDigit` и `MutedText` — своей вёрстки,
 * кроме раскладки в ряд, у молекулы нет.
 */
const KpiBlock = ({ items, size = 22, onDark = false }: KpiBlockProps) => {
  return (
    <div className={styles.root}>
      {items.map((item, index) => (
        <div className={styles.item} key={`${item.label}-${index}`}>
          <BigDigit value={item.value} tone={item.tone} onDark={onDark} size={size} />
          <MutedText text={item.label} onDark={onDark} size={9.5} />
        </div>
      ))}
    </div>
  );
};

export default KpiBlock;
