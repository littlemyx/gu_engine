import { Handle, Position } from '@xyflow/react';
import { usePrototypeStore } from '@/store/prototypeStore';
import type { CardNodeData } from '../types';
import { DescriptionTextarea } from './DescriptionTextarea';
import styles from './MasterPromptCardBody.module.css';

export const MasterPromptCardBody = ({ id, data }: { id: string; data: CardNodeData }) => {
  const { updateNodeData } = usePrototypeStore();

  return (
    <div className={styles.body}>
      <Handle type="source" position={Position.Right} id="prompt_out" />
      <DescriptionTextarea
        value={data.description ?? ''}
        placeholder="Мастер-промпт (стиль, качество)"
        onChange={val => updateNodeData(id, { description: val })}
      />
    </div>
  );
};
