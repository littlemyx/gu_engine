import React from 'react';

import styles from './DragHandle.module.css';

export interface DragHandleProps {
  /** Кегль глифа в px, диапазон макета 8–14. */
  size?: number;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/DragHandle.dc.html` (atoms.json#DragHandle).
 * Хэндл ⠿ для перетаскивания строки: чисто визуальный якорь — курсор grab/grabbing
 * и фокус-рамка задаются CSS-псевдоклассами, своей drag-логики компонент не несёт.
 */
const DragHandle = ({ size = 9, onDark = false }: DragHandleProps) => {
  const className = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <span tabIndex={0} className={className} style={{ fontSize: `${size}px` }}>
      ⠿
    </span>
  );
};

export default DragHandle;
