import React from 'react';

import Tab from '../atoms/Tab';
import AccentText from '../atoms/AccentText';

import styles from './DocumentTabs.module.css';

export interface DocumentTabsItem {
  label: string;
}

export interface DocumentTabsProps {
  /** Вкладки открытых документов, слева направо. */
  tabs: DocumentTabsItem[];
  /** Индекс активной вкладки. */
  active?: number;
  /** Пояснение у правого края полосы (например путь или статус). */
  right?: string;
  onPick?: (index: number, label: string) => void;
}

/**
 * Порт `design_ref/components/DocumentTabs.dc.html` (molecules.json#k011).
 * Полоса вкладок открытых документов на светлой рабочей области: активная
 * вкладка держит светлый инсет-фон и жирную подпись, справа может стоять
 * необязательное акцентное пояснение.
 */
const DocumentTabs = ({ tabs, active = 0, right, onPick }: DocumentTabsProps) => {
  return (
    <div role="tablist" className={styles.root}>
      {tabs.map((tab, index) => (
        <Tab
          key={`${index}-${tab.label}`}
          label={tab.label}
          variant="document"
          closable={false}
          selected={index === active}
          onClick={onPick ? () => onPick(index, tab.label) : undefined}
        />
      ))}
      {right && (
        <span className={styles.right}>
          <AccentText text={right} tone="accent" size={10} />
        </span>
      )}
    </div>
  );
};

export default DocumentTabs;
