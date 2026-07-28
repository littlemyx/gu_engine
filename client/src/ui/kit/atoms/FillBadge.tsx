import React from 'react';

import styles from './FillBadge.module.css';

export interface FillBadgeProps {
  label: string;
  /** Стрелка-раскрытие справа от подписи: «есть v3 · diff ▾». */
  arrow?: boolean;
  uppercase?: boolean;
}

/**
 * Порт `design_ref/components/FillBadge.dc.html` (atoms.json#FillBadge).
 * Залитый акцентный бейдж: текущий выбор, активная версия. Сплошная заливка
 * читается одинаково на любом хроме, поэтому — как и у `PrimaryButton` —
 * `onDark` компоненту не нужен: в макете проп `context` управлял только
 * подложкой превью, а не самим бейджем.
 */
const FillBadge = ({ label, arrow = false, uppercase = true }: FillBadgeProps) => {
  const className = [styles.root, uppercase ? styles.uppercase : ''].filter(Boolean).join(' ');

  return (
    <span className={className}>
      {label}
      {arrow && (
        <span aria-hidden="true" className={styles.arrow}>
          ▾
        </span>
      )}
    </span>
  );
};

export default FillBadge;
