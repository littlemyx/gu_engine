import { useEffect } from 'react';
import { getBatchStatus } from '@root/text_gen/generated_client';
import type { BatchStatus } from '@root/text_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import type { GenerationState, SceneOutput } from '../types';

export const useSceneTextPolling = (nodeId: string, generation?: GenerationState) => {
  const { setGeneration, updateNodeData } = usePrototypeStore();

  useEffect(() => {
    if (!generation || generation.status !== 'generating') return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await getBatchStatus({
          path: { batchId: generation.batchId },
        });
        if (error || !data) {
          clearInterval(interval);
          setGeneration(nodeId, {
            ...generation,
            status: 'failed',
            errors: [{ id: '', error: 'Батч не найден на сервере' }],
          });
          return;
        }
        const status = data as BatchStatus;
        const errors = status.failed.length > 0 ? status.failed : undefined;

        if (status.done) {
          const resultStr = status.completed[0]?.result;
          if (resultStr) {
            try {
              const parsed = JSON.parse(resultStr) as {
                sceneText: string;
                outputs: string[];
              };
              const newOutputs: SceneOutput[] = parsed.outputs.map(text => ({
                id: crypto.randomUUID(),
                text,
              }));
              updateNodeData(nodeId, {
                sceneText: parsed.sceneText,
                outputs: newOutputs,
              });
              setGeneration(nodeId, {
                ...generation,
                status: 'done',
                completedCount: status.completed.length,
                totalCount: status.total,
                errors,
              });
            } catch {
              setGeneration(nodeId, {
                ...generation,
                status: 'failed',
                errors: [{ id: 'sceneText', error: 'Не удалось распарсить ответ модели' }],
              });
            }
          } else {
            setGeneration(nodeId, {
              ...generation,
              status: errors ? 'failed' : 'done',
              completedCount: status.completed.length,
              totalCount: status.total,
              errors,
            });
          }
        } else {
          setGeneration(nodeId, {
            ...generation,
            completedCount: status.completed.length,
            totalCount: status.total,
            errors,
          });
        }
      } catch {
        clearInterval(interval);
        setGeneration(nodeId, {
          ...generation,
          status: 'failed',
          errors: [{ id: '', error: 'Сервер генерации недоступен' }],
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [nodeId, generation, setGeneration, updateNodeData]);
};
