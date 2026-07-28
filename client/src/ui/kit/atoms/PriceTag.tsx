import React from 'react';

import styles from './PriceTag.module.css';

export type PriceTagVariant = 'button' | 'standalone' | 'total';

export interface PriceTagProps {
  value: string;
  variant?: PriceTagVariant;
  /** Реперная точка живёт на тёмном хроме. */
  onDark?: boolean;
  /** Переопределяет размер шрифта варианта, px. */
  sizePx?: number;
}

const VARIANT_CLASS: Record<PriceTagVariant, string> = {
  button: styles.button,
  standalone: styles.standalone,
  total: styles.total,
};

/**
 * Порт `design_ref/components/PriceTag.dc.html` (atoms.json#PriceTag).
 * Стоимость ≈$0.02 рядом с действием: приглушённая цифра внутри кнопки
 * (`button`), чуть заметнее сама по себе (`standalone`) и жирным итогом там,
 * где сумма — главный ответ (`total`).
 */
const PriceTag = ({ value, variant = 'standalone', onDark = false, sizePx }: PriceTagProps) => {
  const className = [styles.root, VARIANT_CLASS[variant], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span className={className} style={sizePx ? { fontSize: `${sizePx}px` } : undefined}>
      {value}
    </span>
  );
};

export default PriceTag;
