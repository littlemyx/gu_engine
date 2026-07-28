import React from 'react';

import CornerMarks from './CornerMarks';

import styles from './PrimaryButton.module.css';

export type PrimaryButtonSize = 'regular' | 'compact';

export interface PrimaryButtonProps {
  label: string;
  /** Глиф перед подписью: ▶, ⟳. Во время загрузки уступает место спиннеру. */
  glyph?: string;
  /** Смета печатается моноширинным прямо в кнопке, никогда в тултипе. */
  price?: string;
  size?: PrimaryButtonSize;
  block?: boolean;
  /** Крестики-реперы по углам. Компактная кнопка их не носит. */
  marks?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/PrimaryButton.dc.html` (atoms.json#PrimaryButton).
 * Единственный залитый объект системы: всё остальное — волосяные рамки.
 * Занятая кнопка не отключается, а показывает спиннер и не пускает клик.
 */
const PrimaryButton = ({
  label,
  glyph,
  price,
  size = 'regular',
  block = false,
  marks = true,
  disabled = false,
  loading = false,
  onClick,
}: PrimaryButtonProps) => {
  const compact = size === 'compact';
  const showMarks = marks && !compact;
  const inert = disabled || loading;

  const className = [
    styles.root,
    compact ? styles.compact : styles.regular,
    block ? styles.block : '',
    loading ? styles.loading : '',
    showMarks ? styles.marked : '',
  ]
    .filter(Boolean)
    .join(' ');

  const button = (
    <button type="button" className={className} disabled={disabled} onClick={inert ? undefined : onClick}>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {glyph && !loading && (
        <span className={styles.glyph} aria-hidden="true">
          {glyph}
        </span>
      )}
      <span>{label}</span>
      {price && <span className={styles.price}>{price}</span>}
    </button>
  );

  if (!showMarks) return button;

  return (
    <CornerMarks tone="accent">
      <span className={block ? styles.markedBlock : undefined}>{button}</span>
    </CornerMarks>
  );
};

export default PrimaryButton;
