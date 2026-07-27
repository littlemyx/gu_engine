import React, { useEffect, useRef } from 'react';

import styles from './Menu.module.css';

export type MenuItem =
  | { kind: 'separator' }
  | {
      kind?: 'item';
      label: string;
      /** Стоимость печатается прямо в пункте меню. */
      cost?: string;
      shortcut?: string;
      /** Чек-марка: пункт-переключатель в «Вид» и «QA». */
      checked?: boolean;
      /** Маркер • у текущей вкладки вьюпорта. */
      current?: boolean;
      disabled?: boolean;
      /** Разрушающее действие: всегда за разделителем и через подтверждение. */
      danger?: boolean;
      onSelect?: () => void;
    };

export interface MenuProps {
  label: string;
  items: MenuItem[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Наведение открывает меню, если одно из соседних уже открыто. */
  onHover: () => void;
  /** `toolbar` — триггер выглядит как кнопка панели действий, а не как пункт строки меню. */
  variant?: 'menubar' | 'toolbar';
  disabled?: boolean;
}

/** Одно выпадающее меню строки меню. Без библиотек: кнопка + список. */
const Menu = ({ label, items, open, onOpen, onClose, onHover, variant = 'menubar', disabled = false }: MenuProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${variant === 'toolbar' ? styles.triggerToolbar : ''} ${
          open ? styles.triggerOpen : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? onClose() : onOpen())}
        onMouseEnter={onHover}
      >
        {label}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          {items.map((item, index) => {
            if (item.kind === 'separator') {
              return <div key={`sep-${index}`} className={styles.separator} role="separator" />;
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  onClose();
                  item.onSelect?.();
                }}
              >
                <span className={styles.mark}>{item.checked ? '✓' : item.current ? '•' : ''}</span>
                <span className={styles.itemLabel}>{item.label}</span>
                {item.cost && <span className={styles.cost}>{item.cost}</span>}
                {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Menu;
