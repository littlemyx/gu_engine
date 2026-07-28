import React from 'react';

import Swatch from '../atoms/Swatch';
import MutedText from '../atoms/MutedText';

import styles from './LegendRow.module.css';

export interface LegendItem {
  /** Цвет квадрата — CSS-значение (обычно токен акцента/нейтрали). */
  color: string;
  /** Словесная подпись рядом со свотчем. */
  label: string;
}

export interface LegendRowProps {
  /** Пункты легенды: свотч + подпись, в порядке отображения. */
  items: LegendItem[];
  /** Пояснение справа от легенды (напр. «21 слот = 7 дней × 3 фазы»). Пусто — не рисуется. */
  note?: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/LegendRow.dc.html` (molecules.json#p025,
 * «ЛЕГЕНДА (свотч+подпись)»).
 * Строка легенды под чертежом или партитурой: список свотч+подпись слева и
 * необязательное пояснение, прижатое вправо. Собрана из атомов `Swatch`
 * (вариант `legend`) и `MutedText` — своей вёрстки у молекулы почти нет.
 */
const LegendRow = ({ items, note = '', onDark = false }: LegendRowProps) => {
  return (
    <div className={styles.root}>
      {items.map((item, index) => (
        <Swatch key={`${item.label}-${index}`} variant="legend" color={item.color} label={item.label} />
      ))}
      {note && (
        <span className={styles.note}>
          <MutedText text={note} onDark={onDark} />
        </span>
      )}
    </div>
  );
};

export default LegendRow;
