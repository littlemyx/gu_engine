import { useEffect } from 'react';
import { getBatchStatus } from '@root/text_gen/generated_client';
import type { BatchStatus } from '@root/text_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import type { GenerationState } from '../types';

export const useTextGenerationPolling = (nodeId: string, generation?: GenerationState) => {
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
          const result = status.completed[0]?.result;
          setGeneration(nodeId, {
            ...generation,
            status: errors && !result ? 'failed' : 'done',
            completedCount: status.completed.length,
            totalCount: status.total,
            errors,
          });
          if (result) {
            updateNodeData(nodeId, { description: result });
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
