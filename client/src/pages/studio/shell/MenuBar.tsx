import React, { useState } from 'react';

import Menu from './Menu';
import styles from './MenuBar.module.css';

import type { MenuItem } from './Menu';

export type MenuGroup = { label: string; items: MenuItem[] };

export interface MenuBarProps {
  groups: MenuGroup[];
  /** «gpt-4.1-mini · text_gen ✓ · image_gen ✓» */
  modelStatus?: string;
  /** Узкий экран: все меню сворачиваются в один бургер. */
  burger?: boolean;
}

/** Верхняя строка меню шелла. */
const MenuBar = ({ groups, modelStatus, burger = false }: MenuBarProps) => {
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  if (burger) {
    // Пункты всех групп подряд, каждая группа отделена разделителем: на
    // узком экране горизонтали под семь меню нет.
    const items: MenuItem[] = groups.flatMap((group, index) => [
      ...(index === 0 ? [] : [{ kind: 'separator' as const }]),
      ...group.items,
    ]);

    return (
      <div className={styles.root}>
        <span className={styles.brand}>GU Engine</span>
        <Menu
          label="☰ Меню"
          items={items}
          open={openLabel != null}
          onOpen={() => setOpenLabel('burger')}
          onClose={() => setOpenLabel(null)}
          onHover={() => undefined}
        />
        {modelStatus && <span className={styles.model}>{modelStatus}</span>}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <span className={styles.brand}>GU Engine</span>
      {groups.map(group => (
        <Menu
          key={group.label}
          label={group.label}
          items={group.items}
          open={openLabel === group.label}
          onOpen={() => setOpenLabel(group.label)}
          onClose={() => setOpenLabel(null)}
          // Когда одно меню раскрыто, наведение перекидывает на соседнее —
          // как в настольных приложениях.
          onHover={() => setOpenLabel(current => (current == null ? current : group.label))}
        />
      ))}
      {modelStatus && <span className={styles.model}>{modelStatus}</span>}
    </div>
  );
};

export default MenuBar;
