import React from 'react';

import Heading from '../atoms/Heading';

import styles from './EstimateTotal.module.css';

export type EstimateTotalSize = 'regular' | 'large';

export interface EstimateTotalProps {
  label: string;
  price: string;
  /** Ступень размера: обычная строка сметы (15px) или крупный итог (20px). */
  size?: EstimateTotalSize;
  /** Красит сумму акцентным тоном — когда итог самое важное на экране. */
  accent?: boolean;
}

const SIZE_PX: Record<EstimateTotalSize, number> = {
  regular: 15,
  large: 20,
};

/**
 * Порт `design_ref/components/EstimateTotal.dc.html` (molecules.json#k042).
 * Итоговая строка сметы: подпись и сумма одним заголовочным шрифтом в один
 * росчерк по базовой линии; `accent` переключает сумму на акцентный тон,
 * когда итог — главный ответ на экране.
 */
const EstimateTotal = ({ label, price, size = 'regular', accent = false }: EstimateTotalProps) => {
  const sizePx = SIZE_PX[size];

  const priceNode = <Heading text={price} uppercase={false} size={sizePx} />;

  return (
    <div className={styles.root}>
      <Heading text={label} uppercase={false} size={sizePx} />
      {accent ? <span className={styles.priceAccent}>{priceNode}</span> : priceNode}
    </div>
  );
};

export default EstimateTotal;
