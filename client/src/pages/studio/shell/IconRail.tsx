import React from 'react';

import styles from './IconRail.module.css';

import type { DockTab } from '../studioStore';

export interface IconRailProps {
  /** Иерархия раскрыта оверлеем. */
  treeOpen: boolean;
  dockTab: DockTab;
  dockOpen: boolean;
  /** Точка «непросмотренное» на сегменте дока (ошибка, готовый батч). */
  attention?: Partial<Record<DockTab, boolean>>;
  onToggleTree: () => void;
  onPickDock: (tab: DockTab) => void;
}

const DOCK_ICONS: Array<{ id: DockTab; glyph: string; title: string }> = [
  { id: 'prefabs', glyph: '◐', title: 'Префабы' },
  { id: 'assets', glyph: '▦', title: 'Ассеты' },
  { id: 'qa', glyph: '✓', title: 'QA' },
];

/**
 * Рельса 44px вместо иерархии на узком экране: дерево и панели дока
 * открываются оверлеем, а не отнимают ширину у вьюпорта.
 */
const IconRail = ({ treeOpen, dockTab, dockOpen, attention = {}, onToggleTree, onPickDock }: IconRailProps) => (
  <nav className={styles.rail}>
    <button
      type="button"
      className={`${styles.button} ${treeOpen ? styles.active : ''}`}
      title="Иерархия истории"
      onClick={onToggleTree}
    >
      ≡
    </button>

    <span className={styles.divider} />

    {DOCK_ICONS.map(icon => (
      <button
        key={icon.id}
        type="button"
        className={`${styles.button} ${dockOpen && dockTab === icon.id ? styles.active : ''}`}
        title={attention[icon.id] ? `${icon.title} — есть непросмотренное` : icon.title}
        onClick={() => onPickDock(icon.id)}
      >
        {icon.glyph}
        {attention[icon.id] && <span className={styles.dot} aria-hidden="true" />}
      </button>
    ))}
  </nav>
);

export default IconRail;
