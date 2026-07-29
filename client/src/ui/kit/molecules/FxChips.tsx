import React from 'react';

import Chip from '../atoms/Chip';
import DashedFrame from '../atoms/DashedFrame';

import styles from './FxChips.module.css';

export interface FxChipItem {
  /** Текст FX-параметра, например «reverb 18%». */
  text: string;
}

export interface FxChipsProps {
  /** Ряд FX-параметров дорожки, слева направо. */
  items: FxChipItem[];
  /** Рисовать у каждой фишки крестик снятия. */
  removable?: boolean;
  /** Подпись пунктирной кнопки добавления; знак «+» — часть подписи. */
  addLabel?: string;
  onDark?: boolean;
  /** Добавить FX. Без колбэка кнопка-триггер не кликабельна. */
  onAdd?: () => void;
  /** Снять FX по тексту фишки. Осмыслен только при `removable`. */
  onRemove?: (text: string) => void;
}

/**
 * Порт `design_ref/components/FxChips.dc.html` (molecules.json#k079, «ЧИПЫ FX»).
 * Ряд фишек звуковых FX-параметров дорожки с необязательным крестиком снятия
 * и пунктирной кнопкой добавления справа. Собран из `Chip` (фишки) и
 * `DashedFrame` (рамка триггера); клик по триггеру обёрнут собственной
 * кнопкой — как в `AddNodeRow` — чтобы фокусируемый узел был один.
 */
const FxChips = ({ items, removable = false, addLabel = '+ FX', onDark = false, onAdd, onRemove }: FxChipsProps) => {
  const frame = (
    <DashedFrame kind="add" onDark={onDark} interactive={false} padding={3}>
      <span className={[styles.addLabel, onDark ? styles.onDark : ''].filter(Boolean).join(' ')}>{addLabel}</span>
    </DashedFrame>
  );

  const triggerClassName = [styles.trigger, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.root}>
      {items.map((item, index) => (
        <Chip
          key={`${index}-${item.text}`}
          label={item.text}
          kind={removable ? 'removable' : 'outline'}
          onDark={onDark}
          onRemove={removable ? () => onRemove?.(item.text) : undefined}
        />
      ))}
      {onAdd ? (
        <button type="button" className={triggerClassName} onClick={onAdd}>
          {frame}
        </button>
      ) : (
        frame
      )}
    </div>
  );
};

export default FxChips;
