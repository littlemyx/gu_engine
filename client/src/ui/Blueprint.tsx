import React from 'react';

import styles from './Blueprint.module.css';

export interface BlueprintProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Реперы рисуются светлыми — для панелей на тёмном хроме. */
  onChrome?: boolean;
  /** Убрать крестики, оставив только волосяную рамку. */
  withoutMarks?: boolean;
  children?: React.ReactNode;
}

/**
 * Обёртка-«чертёж»: рамка в волос толщиной и четыре крестика-репера по углам.
 * Базовый приём дизайн-системы Industry — им размечены карточки и плиты шелла.
 */
const Blueprint = ({ onChrome = false, withoutMarks = false, className, children, ...rest }: BlueprintProps) => {
  const rootClass = [styles.blueprint, onChrome ? styles.onChrome : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={rootClass} {...rest}>
      {children}
      {!withoutMarks && (
        <>
          <i className={`${styles.corner} ${styles.tl}`} aria-hidden="true" />
          <i className={`${styles.corner} ${styles.tr}`} aria-hidden="true" />
          <i className={`${styles.corner} ${styles.bl}`} aria-hidden="true" />
          <i className={`${styles.corner} ${styles.br}`} aria-hidden="true" />
        </>
      )}
    </div>
  );
};

export default Blueprint;
