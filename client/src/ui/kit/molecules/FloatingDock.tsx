import React from 'react';

import AccentUnderline from '../atoms/AccentUnderline';
import Frame from '../atoms/Frame';
import Glyph from '../atoms/Glyph';
import NotifyDot from '../atoms/NotifyDot';
import Shadow from '../atoms/Shadow';

import styles from './FloatingDock.module.css';

export interface FloatingDockItem {
  /** Символ-иконка текстом, как у атома Glyph. */
  glyph: string;
  label: string;
  /** Точка непросмотренного в панели, на которую ведёт вкладка. */
  notify?: boolean;
}

export interface FloatingDockProps {
  items: FloatingDockItem[];
  activeIndex?: number;
  onSelect?: (index: number, label: string) => void;
}

/**
 * Порт `design_ref/components/FloatingDock.dc.html` (molecules.json#p041).
 * Плавающий док панелей поверх канваса: ряд вкладок на тёмном хроме,
 * активная получает акцентную полосу снизу (AccentUnderline), у остальных —
 * приглушённый текст. Без `onSelect` вкладки нерабочие — только просмотр.
 */
const FloatingDock = ({ items, activeIndex = 0, onSelect }: FloatingDockProps) => (
  <Shadow size="lg">
    <Frame tone="dark" interactive={false} padding={0}>
      <div className={styles.row}>
        {items.map((item, index) => {
          const active = index === activeIndex;
          const className = [styles.item, active ? styles.active : ''].filter(Boolean).join(' ');
          const content = (
            <>
              <Glyph glyph={item.glyph} size={12} tone={active ? 'neutral' : 'muted'} onDark />
              {active ? (
                <AccentUnderline label={item.label} withBg={false} onDark />
              ) : (
                <span className={styles.label}>{item.label}</span>
              )}
              {item.notify && <NotifyDot tone="yellow" size={6} onDark />}
            </>
          );

          if (!onSelect) {
            return (
              <span key={`${item.label}-${index}`} role="tab" aria-selected={active} className={className}>
                {content}
              </span>
            );
          }

          return (
            <button
              key={`${item.label}-${index}`}
              type="button"
              role="tab"
              aria-selected={active}
              className={className}
              onClick={() => onSelect(index, item.label)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </Frame>
  </Shadow>
);

export default FloatingDock;
