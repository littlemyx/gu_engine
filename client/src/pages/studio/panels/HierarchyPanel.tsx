import React, { useState } from 'react';

import { applyPrefab } from '@/prefabs/applyPrefab';
import { usePrefabStore } from '@/prefabs/prefabStore';
import HierarchyRow from '@/ui/HierarchyRow';

import { isSameSelection, useStudioStore } from '../studioStore';

import { PREFAB_DND_TYPE } from './PrefabsPanel';

import styles from './panels.module.css';

import type { HierarchyNode } from '../derive/hierarchyModel';

export interface HierarchyPanelProps {
  nodes: HierarchyNode[];
  /** Свернуть панель. Без обработчика кнопка не рисуется (оверлей на узком). */
  onCollapse?: () => void;
  /** Сообщение о результате вставки — уходит в статус-бар. */
  onPrefabApplied: (message: string) => void;
}

/**
 * Левый рейл: дерево истории. Клик по строке выделяет узел; сюда же
 * перетаскиваются префабы из дока — иерархия и есть состав истории.
 */
const HierarchyPanel = ({ nodes, onPrefabApplied, onCollapse }: HierarchyPanelProps) => {
  const selection = useStudioStore(s => s.selection);
  const select = useStudioStore(s => s.select);
  const [over, setOver] = useState(false);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setOver(false);
    const id = event.dataTransfer.getData(PREFAB_DND_TYPE);
    const prefab = usePrefabStore.getState().prefabs.find(p => p.id === id);
    if (!prefab) return;
    const result = applyPrefab(prefab);
    onPrefabApplied(result.invalidatesStory ? `${result.message} · историю нужно перегенерировать` : result.message);
  };

  return (
    <aside
      className={`${styles.rail} ${over ? styles.railDrop : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(PREFAB_DND_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className={styles.panelHead}>
        <span>Иерархия истории</span>
        {onCollapse && (
          <button type="button" className={styles.panelCollapse} onClick={onCollapse} title="Свернуть панель">
            ‹
          </button>
        )}
      </div>
      <div className={styles.railBody}>
        {over && <div className={styles.dropHint}>отпустите — префаб войдёт в историю</div>}
        {nodes.length === 0 && <div className={styles.placeholder}>Пусто</div>}
        {nodes.map(node => (
          <HierarchyRow
            key={node.key}
            label={node.label}
            meta={node.meta}
            icon={node.icon}
            depth={node.depth}
            state={node.state}
            selected={node.selection != null && isSameSelection(node.selection, selection)}
            onClick={node.selection == null ? undefined : () => select(node.selection)}
          />
        ))}
      </div>
    </aside>
  );
};

export default HierarchyPanel;
