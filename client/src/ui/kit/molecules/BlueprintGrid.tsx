import React, { type ReactNode } from 'react';

import MutedText from '../atoms/MutedText';

import styles from './BlueprintGrid.module.css';

export interface BlueprintGridProps {
  /** Шаг сетки в px. В макете диапазон 10–40, по умолчанию 20. */
  step?: number;
  /** Зум — влияет только на дефолтный текст лейбла, саму сетку не масштабирует. Диапазон 10–400, по умолчанию 100. */
  zoom?: number;
  /** Подпись в правом верхнем углу. Без явного значения считается из `zoom`/`step`; `''` скрывает лейбл. */
  label?: string;
  /** Текст-заглушка, когда `children` не передан. */
  placeholder?: string;
  /** Содержимое поверх сетки — обычно кадр вьюпорта. */
  children?: ReactNode;
}

/**
 * Порт `design_ref/components/BlueprintGrid.dc.html` (molecules.json#p046,
 * «ФОН-СЕТКА ВЬЮПОРТА»). Разлинованная подложка вьюпорта: линии сетки с
 * настраиваемым шагом и необязательный лейбл зума в углу. Содержимое
 * кладётся поверх через `children`; без него виден текст-заглушка, как в
 * `renderVals()` исходника.
 */
const BlueprintGrid = ({
  step = 20,
  zoom = 100,
  label,
  placeholder = 'вьюпорт — содержимое кладётся поверх сетки',
  children,
}: BlueprintGridProps) => {
  const resolvedLabel = label ?? `${zoom}% · сетка ${step}px`;
  const hasLabel = resolvedLabel !== '';

  return (
    <div className={styles.root} style={{ backgroundSize: `${step}px ${step}px` }}>
      {hasLabel && (
        <div className={styles.label}>
          <MutedText text={resolvedLabel} size={10} />
        </div>
      )}
      {children ?? <MutedText text={placeholder} size={11} />}
    </div>
  );
};

export default BlueprintGrid;
