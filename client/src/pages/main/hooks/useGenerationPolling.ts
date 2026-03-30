import { useEffect } from 'react';
import { getBatchStatus } from '@root/image_gen/generated_client';
import type { BatchStatus } from '@root/image_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import type { GenerationState } from '../types';

export const useGenerationPolling = (nodeId: string, generation?: GenerationState) => {
  const { setGeneration, setGeneratedImages } = usePrototypeStore();

  useEffect(() => {
    if (!generation || generation.status !== 'generating') return;

    const interval = setInterval(async () => {
      try {
        const { data } = await getBatchStatus({
          path: { batchId: generation.batchId },
        });
        if (!data) return;
        const status = data as BatchStatus;
        const errors = status.failed.length > 0 ? status.failed : undefined;

        // Map completed items to correct indices using itemIds order
        let files: string[];
        if (generation.itemIds) {
          files = new Array(generation.itemIds.length).fill('');
          for (const c of status.completed) {
            const idx = generation.itemIds.indexOf(c.id);
            if (idx !== -1 && c.file) files[idx] = c.file;
          }
        } else {
          files = status.completed.map(c => c.file).filter(Boolean);
        }

        if (status.done) {
          setGeneration(nodeId, {
            ...generation,
            status: errors && !files.some(f => f) ? 'failed' : 'done',
            completedCount: status.completed.length,
            totalCount: status.total,
            files,
            errors,
          });
          if (files.some(f => f)) {
            setGeneratedImages(nodeId, files);
          }
        } else {
          setGeneration(nodeId, {
            ...generation,
            completedCount: status.completed.length,
            totalCount: status.total,
            files,
            errors,
          });
          if (files.some(f => f)) {
            setGeneratedImages(nodeId, files);
          }
        }
      } catch {
        clearInterval(interval);
        setGeneration(nodeId, {
          ...generation,
          status: 'failed',
          errors: [{ id: '', error: 'Сервер генерации недоступен' }],
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [nodeId, generation, setGeneration, setGeneratedImages]);
};
