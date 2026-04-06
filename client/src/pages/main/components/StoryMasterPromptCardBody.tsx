import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { generateStoryMasterPrompt } from '@root/text_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import type { CardNodeData } from '../types';
import { useTextGenerationPolling } from '../hooks/useTextGenerationPolling';
import { DescriptionTextarea } from './DescriptionTextarea';
import { GenerateControls } from './GenerateControls';
import styles from './StoryMasterPromptCardBody.module.css';

export const StoryMasterPromptCardBody = ({ id, data }: { id: string; data: CardNodeData }) => {
  const { updateNodeData, setGeneration } = usePrototypeStore();

  useTextGenerationPolling(id, data.generation);

  const onGenerate = useCallback(async () => {
    try {
      const { data: respData } = await generateStoryMasterPrompt({
        body: {
          userHint: data.description?.trim() || undefined,
        },
      });
      if (respData) {
        const resp = respData as { batchId: string; itemIds: string[] };
        setGeneration(id, {
          batchId: resp.batchId,
          status: 'generating',
          completedCount: 0,
          totalCount: resp.itemIds.length,
          itemIds: resp.itemIds,
        });
      }
    } catch {
      setGeneration(id, { batchId: '', status: 'failed' });
    }
  }, [id, data.description, setGeneration]);

  return (
    <div className={styles.body}>
      <Handle type="source" position={Position.Right} id="prompt_out" />
      <DescriptionTextarea
        value={data.description ?? ''}
        placeholder="Мастер-промпт истории (сюжет, персонажи, мир)"
        onChange={val => updateNodeData(id, { description: val })}
      />
      <GenerateControls generation={data.generation} onGenerate={onGenerate} />
    </div>
  );
};
