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
}) => {
  if (variant === 'background') {
    return (
      <div className={`${styles.masterPromptSection} ${styles.masterPromptSectionBg}`}>
        <Handle
          type="target"
          position={Position.Left}
          id="visual_style"
          className={styles.styleHandleBg}
          isValidConnection={() => {
            const alreadyConnected = edges.some(e => e.target === nodeId && e.targetHandle === 'visual_style');
            return !alreadyConnected;
          }}
        />
        <span className={`${styles.masterPromptLabel} ${styles.masterPromptLabelBg}`}>
          Визуальный мастер-промпт
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.masterPromptSection}>
        <Handle
          type="target"
          position={Position.Left}
          id="visual_style"
          className={styles.styleHandle}
          isValidConnection={() => {
            const alreadyConnected = edges.some(e => e.target === nodeId && e.targetHandle === 'visual_style');
            return !alreadyConnected;
          }}
        />
        <span className={styles.masterPromptLabel}>Визуальный мастер-промпт</span>
      </div>
      <div className={`${styles.masterPromptSection} ${styles.masterPromptSectionStory}`}>
        <Handle
          type="target"
          position={Position.Left}
          id="story_style"
          className={styles.styleHandleStory}
          isValidConnection={() => {
            const alreadyConnected = edges.some(e => e.target === nodeId && e.targetHandle === 'story_style');
            return !alreadyConnected;
          }}
        />
        <span className={`${styles.masterPromptLabel} ${styles.masterPromptLabelStory}`}>
          Мастер-промпт истории
        </span>
      </div>
    </>
  );
};
