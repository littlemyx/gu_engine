import React from 'react';

import styles from './Swatch.module.css';

export type SwatchVariant = 'palette' | 'legend' | 'add';

export interface SwatchProps {
  variant?: SwatchVariant;
  /** Цвет квадрата — CSS-значение (обычно hex), приходит из палитры истории. Не используется в `add`. */
  color?: string;
  /** Сторона квадрата в px. Не используется в `legend` (там фиксированные 10px). */
  size?: number;
  /** Подпись hex-кода под квадратом. Только для `palette`. */
  showHex?: boolean;
  /** Подпись строки легенды. Только для `legend`. */
  label?: string;
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/Swatch.dc.html` (atoms.json#Swatch).
 * Квадрат цвета в трёх обличьях: `palette` — крупный квадрат с hex-подписью
 * для сетки палитры, `legend` — мелкий квадрат со словесной подписью в строке
 * легенды, `add` — пунктирная кнопка добавления нового цвета.
 */
const Swatch = ({
  variant = 'palette',
  color = '#5980a6',
  size = 26,
  showHex = true,
  label = 'трава',
  onClick,
}: SwatchProps) => {
  if (variant === 'add') {
    return (
      <button
        type="button"
        className={styles.add}
        style={{ width: size, height: size }}
        aria-label="добавить цвет"
        onClick={onClick}
      >
        +
      </button>
    );
  }

  if (variant === 'legend') {
    return (
      <span className={styles.legend}>
        <span className={styles.legendBox} style={{ background: color }} aria-hidden="true" />
        <span className={styles.legendLabel}>{label}</span>
      </span>
    );
  }

  const content = (
    <>
      <span className={styles.box} style={{ width: size, height: size, background: color }} />
      {showHex && <span className={styles.hex}>{color}</span>}
    </>
  );

  if (!onClick) {
    return <span className={styles.palette}>{content}</span>;
  }

  return (
    <button type="button" className={styles.paletteButton} onClick={onClick}>
      {content}
    </button>
  );
};

export default Swatch;
