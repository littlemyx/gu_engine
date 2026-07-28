import React, { useState } from 'react';

import Logo from '../atoms/Logo';
import MenuItem, { type MenuItemMark } from '../atoms/MenuItem';
import MutedText from '../atoms/MutedText';

import styles from './MenuBar.module.css';

export interface MenuBarEntry {
  label: string;
  /** Хоткей mono-строкой у правого края (`⌘G`). */
  hotkey?: string;
  /** Смета mono-строкой у правого края, перед хоткеем. */
  price?: string;
  mark?: MenuItemMark;
  /** Волосяная линия над пунктом — начало новой группы меню. */
  separator?: boolean;
  disabled?: boolean;
}

export interface MenuBarMenu {
  /** Заголовок столбца («Файл», «Правка»…). */
  name: string;
  items: MenuBarEntry[];
}

export interface MenuBarProps {
  items: MenuBarMenu[];
  /** Столбец, подсвеченный постоянно — не только пока открыт его попап. */
  active?: string;
  /** Фирменный знак в левом углу бара. */
  logoText?: string;
  /** Правый край бара — обычно имя файла проекта. */
  project?: string;
  onPick?: (menu: string, item: string) => void;
}

/**
 * Порт `design_ref/components/MenuBar.dc.html` (molecules.json#k001).
 * Верхний менюбар шелла: логотип, столбцы выпадающих меню, имя проекта справа.
 * Какой столбец открыт — локальное UI-состояние компонента; Escape закрывает
 * его, повторный клик по тому же заголовку — тоже.
 */
const MenuBar = ({ items, active, logoText = 'GU Engine', project, onPick }: MenuBarProps) => {
  const [open, setOpen] = useState<string | null>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') setOpen(null);
  };

  const pick = (menu: string, label: string) => {
    setOpen(null);
    onPick?.(menu, label);
  };

  return (
    <div className={styles.root} onKeyDown={handleKeyDown}>
      <span className={styles.logo}>
        <Logo text={logoText} tone="muted" onDark size={11} />
      </span>
      {items.map(menu => {
        const isOpen = open === menu.name;
        const isOn = isOpen || active === menu.name;
        const triggerClass = [styles.trigger, isOn ? styles.triggerOn : ''].filter(Boolean).join(' ');

        return (
          <span key={menu.name} className={styles.column}>
            <button
              type="button"
              className={triggerClass}
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => setOpen(current => (current === menu.name ? null : menu.name))}
            >
              {menu.name}
            </button>
            {isOpen && (
              <span className={styles.panel}>
                {menu.items.map((entry, index) => (
                  <MenuItem
                    key={`${entry.label}-${index}`}
                    label={entry.label}
                    hotkey={entry.hotkey}
                    price={entry.price}
                    mark={entry.mark}
                    separator={entry.separator}
                    disabled={entry.disabled}
                    onDark
                    onClick={onPick ? () => pick(menu.name, entry.label) : undefined}
                  />
                ))}
              </span>
            )}
          </span>
        );
      })}
      <span aria-hidden="true" className={styles.spacer} />
      {project && <MutedText text={project} onDark quiet size={11} />}
    </div>
  );
};

export default MenuBar;
