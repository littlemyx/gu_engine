import React from 'react';

import Tab from '../atoms/Tab';
import MutedText from '../atoms/MutedText';

import styles from './BottomTabs.module.css';

export interface BottomTabsItem {
  label: string;
}

export interface BottomTabsProps {
  /** Вкладки нижней панели, слева направо. */
  tabs: BottomTabsItem[];
  /** Индекс активной вкладки; игнорируется, пока `collapsed`. */
  active?: number;
  /** Панель свёрнута: подсветка активной вкладки гаснет, справа — пояснение. */
  collapsed?: boolean;
  onPick?: (index: number, label: string) => void;
}

/**
 * Порт `design_ref/components/BottomTabs.dc.html` (molecules.json#k020, #k033).
 * Ряд вкладок нижней панели тулбара на тёмном хроме: активная вкладка держит
 * акцентный underline (тот же приём, что и у `Tab` варианта `underline`), а в
 * свёрнутом состоянии подсветка гаснет и рядом появляется пояснение «свёрнуто».
 */
const BottomTabs = ({ tabs, active = 0, collapsed = false, onPick }: BottomTabsProps) => {
  return (
    <div role="tablist" className={styles.root}>
      {tabs.map((tab, index) => (
        <Tab
          key={`${index}-${tab.label}`}
          label={tab.label}
          variant="underline"
          selected={!collapsed && index === active}
          onClick={onPick ? () => onPick(index, tab.label) : undefined}
        />
      ))}
      {collapsed && (
        <span className={styles.collapsedHint}>
          <MutedText text="свёрнуто" onDark quiet size={10} />
        </span>
      )}
    </div>
  );
};

export default BottomTabs;
