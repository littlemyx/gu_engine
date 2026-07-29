import React from 'react';

import styles from './DisclosureArrow.module.css';

/**
 * Куда «смотрит» стрелка. `down` — исходное поведение (▸ свёрнуто / ▾
 * развёрнуто, контент раскрывается вниз). `right`/`left` — горизонтальные
 * пары для док-панелей (`PanelSpine` и т. п.): стрелка указывает, в какую
 * сторону раскроется панель, и разворачивается на 180° при переключении.
 */
export type DisclosureArrowDirection = 'down' | 'right' | 'left';

const GLYPHS: Record<DisclosureArrowDirection, { collapsed: string; expanded: string }> = {
  down: { collapsed: '▸', expanded: '▾' },
  right: { collapsed: '▸', expanded: '◂' },
  left: { collapsed: '◂', expanded: '▸' },
};

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
  /** Пара глифов. По умолчанию `down` — прежнее поведение без изменений. */
  direction?: DisclosureArrowDirection;
}

/**
 * Порт `design_ref/components/DisclosureArrow.dc.html` (atoms.json#DisclosureArrow).
 * Глиф-переключатель раскрытия: ▸ свёрнуто, ▾ развёрнуто. Состояние держит
 * вызывающая сторона, компонент только рисует и сообщает о клике.
 * `direction` добавляет горизонтальные пары (◂/▸) сверх дизайн-исходника — их
 * запросили молекулы док-панелей (см. kit-conventions.md#когда-атом-не-подходит).
 */
const DisclosureArrow = ({
  expanded = false,
  size = 10,
  onDark = false,
  label = 'Раскрыть',
  onToggle,
  direction = 'down',
}: DisclosureArrowProps) => {
  const className = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const boxPx = Math.round(size * 1.7);
  const style: React.CSSProperties = {
    width: `${boxPx}px`,
    height: `${boxPx}px`,
    fontSize: `${size}px`,
  };
  const glyph = expanded ? GLYPHS[direction].expanded : GLYPHS[direction].collapsed;

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
