import React from 'react';

import Divider from '../atoms/Divider';
import IconButton from '../atoms/IconButton';
import MutedText from '../atoms/MutedText';
import ToneSurface from '../atoms/ToneSurface';

import styles from './IconRail.module.css';

export interface IconRailItem {
  /** Неизменяемый глиф пункта: один символ, например ≡ ◐ ▦ ✓. */
  glyph: string;
  /** Название пункта — уходит в title/aria-label кнопки. */
  label: string;
  disabled?: boolean;
}

export interface IconRailProps {
  items: IconRailItem[];
  /** Индекс выбранного пункта. */
  active?: number;
  /** Вертикальная подпись у подножия рельсы. Пустая строка — подписи нет. */
  note?: string;
  onSelect?: (index: number, item: IconRailItem) => void;
}

/**
 * Порт `design_ref/components/IconRail.dc.html` (molecules.json#p039, «РЕЛЬСА ИКОНОК 44px»).
 * Вертикальная 44px-рельса левого края шелла: столбик квадратных кнопок-глифов
 * с подсвеченным активным пунктом; необязательная вертикальная подпись у
 * подножия отделена волосяной чертой.
 */
const IconRail = ({ items, active = 0, note = '', onSelect }: IconRailProps) => (
  <ToneSurface tone="darkAccent" padding={0}>
    <div className={styles.rail}>
      {items.map((item, index) => {
        const selected = index === active;
        const itemClassName = [styles.item, selected ? styles.selected : ''].filter(Boolean).join(' ');

        return (
          <span key={`${item.glyph}-${index}`} className={itemClassName}>
            <IconButton
              glyph={item.glyph}
              hint={item.label}
              size="toolbar"
              onDark
              disabled={item.disabled}
              onClick={onSelect ? () => onSelect(index, item) : undefined}
            />
          </span>
        );
      })}
      {note !== '' && (
        <>
          <Divider orientation="horizontal" onDark quiet length={24} />
          <span className={styles.note}>
            <MutedText text={note} onDark quiet size={9} />
          </span>
        </>
      )}
    </div>
  </ToneSurface>
);

export default IconRail;
