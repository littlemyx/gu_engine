import React from 'react';

import styles from './shell.module.css';

import type { StructureNode } from '../derive/structureModel';

export interface SidebarStructureProps {
  nodes: StructureNode[];
  onSelect?: (node: StructureNode) => void;
}

/**
 * Вкладка «Структура»: как устроена история — акты, биты, персонажи, локации.
 * Ни статуса генерации, ни сбоев: за производство отвечает «Пайплайн».
 */
const SidebarStructure = ({ nodes, onSelect }: SidebarStructureProps) => {
  if (nodes.length === 0) {
    return <div className={styles.empty}>История ещё не собрана.</div>;
  }

  return (
    <div>
      <div className={styles.kicker}>Структура истории</div>
      {nodes.map(node => (
        <button
          key={node.key}
          type="button"
          className={[styles.zoneRow, node.state === 'selected' ? styles.zoneRowActive : ''].filter(Boolean).join(' ')}
          style={{ paddingLeft: `calc(var(--space-2) + ${node.depth} * var(--space-4))` }}
          onClick={() => onSelect?.(node)}
        >
          <span aria-hidden="true">{node.icon}</span>
          <span>{node.label}</span>
          {node.meta && <span className={styles.zoneRowCounts}>{node.meta}</span>}
        </button>
      ))}
    </div>
  );
};

export default SidebarStructure;
