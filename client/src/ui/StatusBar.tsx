import React from 'react';

import styles from './StatusBar.module.css';

import type { ShellMode } from './ShellToolbar';

export interface StatusBarProps {
  mode?: ShellMode;
  /** Левые поля статуса; порядок значим. */
  items?: string[];
  /** Правое поле: seed-поповер и web-lock. */
  right?: React.ReactNode;
}

const DEFAULT_ITEMS: Record<ShellMode, string[]> = {
  idle: ['черновик не сохранялся', 'слотов — · событий —', 'QA: не запускался после правок'],
  running: ['прогон идёт', 'автосохранение —'],
  blocked: ['QA: ошибки', 'экспорт заблокирован'],
  empty: ['черновик пуст', 'потрачено $0.00'],
};

/** Нижняя строка шелла; режим синхронен с ShellToolbar. */
const StatusBar = ({ mode = 'idle', items, right = 'seed —' }: StatusBarProps) => {
  const fields = items ?? DEFAULT_ITEMS[mode] ?? DEFAULT_ITEMS.idle;

  return (
    <div className={styles.root}>
      {fields.map((item, index) => (
        <span key={`${index}-${item}`} className={mode === 'blocked' ? styles.warning : undefined}>
          {item}
        </span>
      ))}
      <span className={styles.right}>{right}</span>
    </div>
  );
};

export default StatusBar;
