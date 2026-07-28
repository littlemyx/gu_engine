import React from 'react';

import styles from './MenuItem.module.css';

export type MenuItemMark = 'none' | 'check' | 'radio';

export interface MenuItemProps {
  label: string;
  /** Хоткей mono-строкой у правого края (`⌘G`). */
  hotkey?: string;
  /** Смета mono-строкой у правого края, перед хоткеем. */
  price?: string;
  mark?: MenuItemMark;
  /** Персистентная подсветка — пункт выделен, но не обязательно отмечен. */
  hot?: boolean;
  disabled?: boolean;
  /** Волосяная линия над пунктом — начало новой группы меню. */
  separator?: boolean;
  onDark?: boolean;
  onClick?: () => void;
}

const MARK_GLYPH: Record<MenuItemMark, string> = {
  none: '',
  check: '✓',
  radio: '•',
};

/**
 * Порт `design_ref/components/MenuItem.dc.html` (atoms.json#MenuItem).
 * Строка меню: глиф-колонка (галка/точка) + лейбл + смета/хоткей moно.
 * `hot` — постоянная подсветка (не hover), `separator` рисует волосяную
 * линию перед пунктом — начало новой группы.
 */
const MenuItem = ({
  label,
  hotkey,
  price,
  mark = 'none',
  hot = false,
  disabled = false,
  separator = false,
  onDark = false,
  onClick,
}: MenuItemProps) => {
  const rootClass = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const itemClass = [styles.item, hot ? styles.hot : '', disabled ? styles.disabled : ''].filter(Boolean).join(' ');

  const content = (
    <>
      <span className={styles.mark} aria-hidden="true">
        {MARK_GLYPH[mark]}
      </span>
      <span className={styles.label}>{label}</span>
      {price && <span className={styles.price}>{price}</span>}
      {hotkey && <span className={styles.hotkey}>{hotkey}</span>}
    </>
  );

  return (
    <div className={rootClass}>
      {separator && <span className={styles.separator} aria-hidden="true" />}
      {onClick ? (
        <button type="button" className={itemClass} disabled={disabled} onClick={disabled ? undefined : onClick}>
          {content}
        </button>
      ) : (
        <div className={itemClass} aria-disabled={disabled || undefined}>
          {content}
        </div>
      )}
    </div>
  );
};

export default MenuItem;
