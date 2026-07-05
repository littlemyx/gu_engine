import { useEffect, useRef } from 'react';
import { getAudioBatchStatus } from '@root/audio_gen/generated_client';
import type { BatchStatus } from '@root/audio_gen/generated_client';
import type { GenerationState } from '../types';

const POLL_INTERVAL_MS = 10_000;
// Suno-генерация идёт минуты: один сбой сети/рестарт сервера не должен
// терминально ронять трекинг. Роняем после нескольких сбоев подряд.
const MAX_CONSECUTIVE_FAILURES = 3;

export type AudioPollingCallbacks = {
  onUpdate: (generation: GenerationState) => void;
  onFiles: (files: string[]) => void;
};

/**
 * Поллинг одного аудио-батча. Интервал стабилен на всю генерацию:
 * эффект зависит только от batchId и факта «идёт генерация», прогресс
 * читается через ref — прогресс-записи в store не пересоздают таймер.
 */
export const useAudioBatchPolling = (generation: GenerationState | undefined, callbacks: AudioPollingCallbacks) => {
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const batchId = generation?.status === 'generating' ? generation.batchId : undefined;

  useEffect(() => {
    if (!batchId) return;

    let failures = 0;
    let cancelled = false;

    const tick = async () => {
      const current = generationRef.current;
      if (!current || current.status !== 'generating') return;
      try {
        const { data, error } = await getAudioBatchStatus({ path: { batchId } });
        if (cancelled) return;
        if (error || !data) {
          // 404 — батч умер (рестарт audio_gen): терминально.
          clearInterval(interval);
          callbacksRef.current.onUpdate({
            ...current,
            status: 'failed',
            errors: [{ id: '', error: 'Батч не найден на сервере' }],
          });
          return;
        }
        failures = 0;
        const status = data as BatchStatus;
        const errors = status.failed.length > 0 ? status.failed : undefined;

        let files: string[];
        if (current.itemIds) {
          files = new Array(current.itemIds.length).fill('');
          for (const c of status.completed) {
            const idx = current.itemIds.indexOf(c.id);
            if (idx !== -1 && c.file) files[idx] = c.file;
          }
        } else {
          files = status.completed.map(c => c.file).filter(Boolean);
        }

        if (files.some(f => f)) {
          callbacksRef.current.onFiles(files);
        }

        if (status.done) {
          clearInterval(interval);
          callbacksRef.current.onUpdate({
            ...current,
            status: errors && !files.some(f => f) ? 'failed' : 'done',
            completedCount: status.completed.length,
            totalCount: status.total,
            files,
            errors,
          });
        } else {
          callbacksRef.current.onUpdate({
            ...current,
            completedCount: status.completed.length,
            totalCount: status.total,
            files,
            errors,
          });
        }
      } catch {
        if (cancelled) return;
        failures++;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          clearInterval(interval);
          callbacksRef.current.onUpdate({
            ...generationRef.current!,
            status: 'failed',
            errors: [{ id: '', error: 'Сервер генерации аудио недоступен' }],
          });
        }
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [batchId]);
};
