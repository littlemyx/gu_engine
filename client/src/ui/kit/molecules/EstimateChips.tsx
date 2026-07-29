import React from 'react';

import CheckGlyph from '../atoms/CheckGlyph';
import PriceTag from '../atoms/PriceTag';

import styles from './EstimateChips.module.css';

export interface EstimateChipsItem {
  /** Подпись фишки: жанр или блок охвата, например «проза», «медиа». */
  label: string;
  /** Смета охвата, моноширинным рядом с подписью, например «+≈$2.10». */
  price?: string;
  selected?: boolean;
}

export interface EstimateChipsProps {
  /** Ряд переключаемых фишек охвата сметы, слева направо. */
  items: EstimateChipsItem[];
  onDark?: boolean;
  /** Зовётся с индексом фишки; включение/выключение решает вызывающий. */
  onToggle?: (index: number) => void;
}

/**
 * Порт `design_ref/components/EstimateChips.dc.html` (molecules.json#k035,
 * «ЧИПЫ ОХВАТА СМЕТЫ»). Ряд фишек-переключателей охвата генерации: включённая
 * фишка несёт галочку (CheckGlyph) и акцентный тон, выключенная — только
 * подпись приглушённым контуром. Необязательная смета печатается моноширинным
 * PriceTag рядом с подписью, как в кнопках кита.
 */
const EstimateChips = ({ items, onDark = false, onToggle }: EstimateChipsProps) => {
  return (
    <div className={styles.root}>
      {items.map((item, index) => {
        const selected = item.selected ?? false;
        const className = [styles.chip, selected ? styles.selected : styles.unselected, onDark ? styles.onDark : '']
          .filter(Boolean)
          .join(' ');

        const content = (
          <>
            {selected && <CheckGlyph tone="ok" onDark={onDark} size={9} />}
            <span className={styles.label}>{item.label}</span>
            {item.price && (
              <>
                {' '}
                <PriceTag value={item.price} variant="button" onDark={onDark} />
              </>
            )}
          </>
        );

        if (!onToggle) {
          return (
            <span key={`${index}-${item.label}`} className={className}>
              {content}
            </span>
          );
        }

        return (
          <button
            key={`${index}-${item.label}`}
            type="button"
            className={className}
            aria-pressed={selected}
            onClick={() => onToggle(index)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
};

export default EstimateChips;
