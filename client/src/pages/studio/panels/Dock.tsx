import React from 'react';

import { IconAssets, IconPrefabs, IconQa } from '@/ui/icons';

import { useStudioStore } from '../studioStore';

import AssetsPanel from './AssetsPanel';
import ConsolePanel from './ConsolePanel';
import PrefabsPanel from './PrefabsPanel';
import QaPanel from './QaPanel';

import styles from './panels.module.css';

import type { AssetsPanelProps } from './AssetsPanel';
import type { PrefabsPanelProps } from './PrefabsPanel';
import type { QaPanelProps } from './QaPanel';
import type { DockTab } from '../studioStore';

const TABS: { id: DockTab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'prefabs', label: 'Префабы', Icon: IconPrefabs },
  { id: 'assets', label: 'Ассеты', Icon: IconAssets },
  { id: 'qa', label: 'QA', Icon: IconQa },
];

export interface DockProps {
  running: boolean;
  assets: AssetsPanelProps;
  prefabs: PrefabsPanelProps;
  qa: QaPanelProps;
  /** Сводка справа в шапке: своя для каждой вкладки. */
  summary: Record<DockTab, string>;
  /**
   * Узкий экран: док — полоса вкладок, а содержимое всплывает поверх
   * вьюпорта, чтобы не отъедать и без того малую высоту.
   */
  floating?: boolean;
}

/**
 * Нижняя зона: слева выбранная вкладка, справа консоль генерации — она видна
 * всегда, потому что прогон идёт параллельно любой работе автора.
 */
const Dock = ({ running, assets, prefabs, qa, summary, floating = false }: DockProps) => {
  const tab = useStudioStore(s => s.dockTab);
  const setTab = useStudioStore(s => s.setDockTab);
  const open = useStudioStore(s => s.dockOpen);
  const toggle = useStudioStore(s => s.toggleDock);

  return (
    <section className={`${styles.dock} ${floating ? styles.dockFloating : ''}`}>
      <div className={styles.dockTabs}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.dockTab} ${open && tab === id ? styles.dockTabActive : ''}`}
            onClick={() => (open && tab === id ? toggle() : setTab(id))}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
        <span className={styles.dockSummary}>{summary[tab]}</span>
        <button type="button" className={styles.dockToggle} onClick={toggle}>
          {open ? '▾ свернуть' : '▴ развернуть'}
        </button>
      </div>

      {open && (
        <div className={`${styles.dockSplit} ${floating ? styles.dockSplitFloating : ''}`}>
          {tab === 'assets' && <AssetsPanel {...assets} />}
          {tab === 'qa' && <QaPanel {...qa} />}
          {tab === 'prefabs' && <PrefabsPanel {...prefabs} />}

          <div className={styles.consoleColumn}>
            <div className={styles.consoleHead}>Консоль генерации</div>
            <ConsolePanel running={running} />
          </div>
        </div>
      )}
    </section>
  );
};

export default Dock;
