import React from 'react';

import Frame from '../atoms/Frame';
import MenuItem, { type MenuItemMark } from '../atoms/MenuItem';
import Shadow from '../atoms/Shadow';
import ToneSurface from '../atoms/ToneSurface';

import styles from './MenuPanel.module.css';

export interface MenuPanelItem {
  label: string;
  /** Хоткей mono-строкой у правого края (`⌘G`). Взаимоисключим с `price`. */
  hotkey?: string;
  /** Смета mono-строкой у правого края, перед хоткеем. */
  price?: string;
  mark?: MenuItemMark;
  /** Персистентная подсветка — пункт выделен, но не обязательно отмечен. */
  hot?: boolean;
  disabled?: boolean;
  /** Волосяная линия над пунктом — начало новой группы меню. */
  separator?: boolean;
}

export interface MenuPanelProps {
  /** Надзаголовок над панелью. Пустая строка/отсутствие скрывает его. */
  title?: string;
  items: MenuPanelItem[];
  /** px, 180–340. */
  width?: number;
  onPick?: (index: number, label: string) => void;
}

/**
 * Порт `design_ref/components/MenuPanel.dc.html` (molecules.json#p036).
 * Выпадающее меню студии: опциональный кикер-заголовок и залитая тёмная
 * панель с рядами `MenuItem` — хоткеи/сметы, персистентная подсветка (`hot`),
 * группы через `separator` каждого пункта. Панель всегда живёт на тёмном
 * хроме — так же, как в макете (там `context` пунктов зашит константой).
 */
const MenuPanel = ({ title, items, width = 250, onPick }: MenuPanelProps) => {
  const hasTitle = Boolean(title);

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      {hasTitle && <span className={styles.title}>{title}</span>}
      <Shadow size="lg">
        <Frame tone="dark" interactive={false} padding={0}>
          <ToneSurface tone="darkAccent" padding={0}>
            <div className={styles.list}>
              {items.map((item, index) => (
                <MenuItem
                  key={`${index}-${item.label}`}
                  label={item.label}
                  hotkey={item.hotkey}
                  price={item.price}
                  mark={item.mark}
                  hot={item.hot}
                  disabled={item.disabled}
                  separator={item.separator}
                  onDark
                  onClick={onPick ? () => onPick(index, item.label) : undefined}
                />
              ))}
            </div>
          </ToneSurface>
        </Frame>
      </Shadow>
    </div>
  );
};

export default MenuPanel;
