import React from 'react';

import DashedFrame from '../atoms/DashedFrame';
import MutedText from '../atoms/MutedText';

import styles from './AddNodeRow.module.css';

export interface AddNodeRowProps {
  /** Подпись строки. */
  label?: string;
  /** Уточнение, дописывается после подписи через « — ». Пусто — не рисуется. */
  hint?: string;
  onDark?: boolean;
  /** Ширина строки в px; в макете диапазон 180–400. */
  width?: number;
  /** Добавить бит/ветку. Без колбэка строка не кликабельна. */
  onAdd?: () => void;
}

/**
 * Порт `design_ref/components/AddNodeRow.dc.html` (molecules.json#k010,
 * «ДОБАВИТЬ БИТ / ВЕТКУ»).
 * Пунктирная строка-приглашение в конце партитуры/конвейера: клик добавляет
 * новый бит или ветку. Собрана из `DashedFrame` (вид `add`) и `MutedText`;
 * фокус и hover-подсветку несёт собственная кнопка-обёртка, а не рамка —
 * иначе внутри `<button>` оказался бы второй фокусируемый узел.
 */
const AddNodeRow = ({
  label = '+ добавить бит или ветку',
  hint = '',
  onDark = false,
  width = 240,
  onAdd,
}: AddNodeRowProps) => {
  const text = hint ? `${label} — ${hint}` : label;

  const frame = (
    <DashedFrame kind="add" onDark={onDark} interactive={false} padding={6}>
      <div className={styles.body} style={{ width: `${width}px` }}>
        <MutedText text={text} onDark={onDark} quiet size={10} />
      </div>
    </DashedFrame>
  );

  if (!onAdd) {
    return frame;
  }

  const triggerClassName = [styles.trigger, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <button type="button" className={triggerClassName} onClick={onAdd}>
      {frame}
    </button>
  );
};

export default AddNodeRow;
