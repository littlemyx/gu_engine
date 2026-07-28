import React from 'react';

import AccentText from '../atoms/AccentText';
import Divider from '../atoms/Divider';
import Glyph from '../atoms/Glyph';
import MonoText from '../atoms/MonoText';
import TextLabel from '../atoms/TextLabel';

import styles from './StatusBar.module.css';

export type StatusBarTone = 'default' | 'accent' | 'info' | 'error' | 'warn';

export interface StatusBarItem {
  /** Текст сегмента: «черновик сохранён 12:41», «QA: 1 ошибка · 3 предупреждения». */
  text: string;
  /** Ведущий символ-иконка перед текстом (⟳, ⏸, ⛔ и т.п.). */
  glyph?: string;
  tone?: StatusBarTone;
  /** Жирное начертание — заголовок состояния прогона (пауза, блокировка). */
  emphasis?: boolean;
}

export interface StatusBarProps {
  /** Сегменты слева направо, разделённые волосяной чертой. */
  items: StatusBarItem[];
  /** Правая моноширинная сводка — seed, замечание о веб-локе. */
  right?: string;
}

const GLYPH_TONE: Record<StatusBarTone, 'neutral' | 'accent' | 'info' | 'error' | 'warn'> = {
  default: 'neutral',
  accent: 'accent',
  info: 'info',
  error: 'error',
  warn: 'warn',
};

/**
 * Порт `design_ref/components/StatusBar.dc.html` (molecules.json#k021, #k092).
 * Статус-строка нижнего края студии: ряд сегментов состояния прогона слева
 * (черновик, слоты, QA, прогресс прогона) и служебная моноширинная сводка
 * (seed, веб-лок) справа. У исходника нет пропа `context` — строка всегда
 * живёт на тёмном хроме подвала, поэтому `onDark` здесь не нужен.
 */
const StatusBar = ({ items, right }: StatusBarProps) => {
  return (
    <div className={styles.root}>
      {items.map((item, index) => {
        const tone = item.tone ?? 'default';
        return (
          <React.Fragment key={index}>
            {index > 0 ? <Divider orientation="vertical" onDark length={12} /> : null}
            <span className={styles.item}>
              {item.glyph ? <Glyph glyph={item.glyph} tone={GLYPH_TONE[tone]} onDark /> : null}
              {tone === 'default' ? (
                <TextLabel text={item.text} onDark bold={item.emphasis} />
              ) : (
                <AccentText text={item.text} tone={tone} onDark bold={item.emphasis} />
              )}
            </span>
          </React.Fragment>
        );
      })}
      {right ? (
        <span className={styles.right}>
          <MonoText text={right} onDark muted />
        </span>
      ) : null}
    </div>
  );
};

export default StatusBar;
