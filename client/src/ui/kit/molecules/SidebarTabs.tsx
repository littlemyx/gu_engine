import React from 'react';

import Tab from '../atoms/Tab';

import styles from './SidebarTabs.module.css';

export interface SidebarTabsItem {
  label: string;
  /** Точка непросмотренного у конкретной вкладки. */
  notify?: boolean;
}

export interface SidebarTabsProps {
  /** Вкладки боковой панели, делят ширину поровну. */
  tabs: SidebarTabsItem[];
  /** Индекс активной вкладки. */
  active?: number;
  onPick?: (index: number, label: string) => void;
}

/**
 * Порт `design_ref/components/SidebarTabs.dc.html` (molecules.json#k004).
 * Ряд вкладок боковой панели на тёмном хроме, растянутый в общую подложку:
 * вкладки делят ширину поровну (`Tab` варианта `underline`), активная держит
 * акцентный underline, непросмотренные помечены точкой.
 */
const SidebarTabs = ({ tabs, active = 0, onPick }: SidebarTabsProps) => {
  return (
    <div className={styles.wrap}>
      <div role="tablist" className={styles.root}>
        {tabs.map((tab, index) => (
          <Tab
            key={`${index}-${tab.label}`}
            label={tab.label}
            variant="underline"
            selected={index === active}
            notify={tab.notify}
            onClick={onPick ? () => onPick(index, tab.label) : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default SidebarTabs;
