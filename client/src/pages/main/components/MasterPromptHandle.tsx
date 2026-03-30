import { Handle, Position } from '@xyflow/react';
import type { CardEdge } from '../types';
import styles from './MasterPromptHandle.module.css';

export const MasterPromptHandle = ({
  nodeId,
  edges,
  variant = 'character',
}: {
  nodeId: string;
  edges: CardEdge[];
  variant?: 'character' | 'background';
}) => (
  <div className={`${styles.masterPromptSection} ${variant === 'background' ? styles.masterPromptSectionBg : ''}`}>
    <Handle
      type="target"
      position={Position.Left}
      id="style"
      className={variant === 'background' ? styles.styleHandleBg : styles.styleHandle}
      isValidConnection={() => {
        const alreadyConnected = edges.some(e => e.target === nodeId && e.targetHandle === 'style');
        return !alreadyConnected;
      }}
    />
    <span className={`${styles.masterPromptLabel} ${variant === 'background' ? styles.masterPromptLabelBg : ''}`}>
      Мастер-промпт
    </span>
  </div>
);
