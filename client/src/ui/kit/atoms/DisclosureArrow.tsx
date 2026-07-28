import React from 'react';

import styles from './DisclosureArrow.module.css';

export interface DisclosureArrowProps {
  /** collapsed (▸) / expanded (▾). */
  expanded?: boolean;
  /** Кегль в px, диапазон макета 8–14. */
  size?: number;
  onDark?: boolean;
  /** Доступное имя кнопки — фиксированный глиф само по себе ничего не говорит. */
  label?: string;
  /** Без колбэка стрелка немая — рендерится как span, а не кнопка. */
  onToggle?: (expanded: boolean) => void;
}

/**
 * Порт `design_ref/components/DisclosureArrow.dc.html` (atoms.json#DisclosureArrow).
 * Глиф-переключатель раскрытия: ▸ свёрнуто, ▾ развёрнуто. Состояние держит
 * вызывающая сторона, компонент только рисует и сообщает о клике.
 */
const DisclosureArrow = ({
  expanded = false,
  size = 10,
  onDark = false,
  label = 'Раскрыть',
  onToggle,
}: DisclosureArrowProps) => {
  const className = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const boxPx = Math.round(size * 1.7);
  const style: React.CSSProperties = {
    width: `${boxPx}px`,
    height: `${boxPx}px`,
    fontSize: `${size}px`,
  };
  const glyph = expanded ? '▾' : '▸';

  if (!onToggle) {
    return (
      <span className={className} style={style} aria-hidden="true">
        {glyph}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-expanded={expanded}
      aria-label={label}
      onClick={() => onToggle(!expanded)}
    >
      {glyph}
    </button>
  );
};

export default DisclosureArrow;
