import { useCallback, useEffect, useRef, useState } from 'react';
import { generateOutline, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, StoryOutlinePlan } from './types';
import { parseStoryOutline } from './types';
import { buildOutlineRequestPayload } from './buildOutlineRequest';
import { useNarrativeStore } from './narrativeStore';

export type StoryOutlineGenStatus =
  | { state: 'idle' }
  | { state: 'generating'; batchId: string }
  | { state: 'done'; outline: StoryOutlinePlan; rawJson: string; batchId: string }
  | { state: 'error'; message: string; batchId?: string };

export function useStoryOutlineGeneration() {
  const [status, setStatus] = useState<StoryOutlineGenStatus>({ state: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setStoryOutline = useNarrativeStore(s => s.setStoryOutline);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const generate = useCallback(
    async (brief: Brief) => {
      stopPolling();
      setStatus({ state: 'generating', batchId: '' });

      try {
        const { data, error } = await generateOutline({
          body: buildOutlineRequestPayload(brief),
        });
        if (error || !data) {
          setStatus({
            state: 'error',
            message:
              typeof error === 'object' &&
              error &&
              'error' in error &&
              typeof (error as { error: unknown }).error === 'string'
                ? (error as { error: string }).error
                : 'не удалось запустить генерацию',
          });
          return;
        }
        const batchId = data.batchId;
        setStatus({ state: 'generating', batchId });

        intervalRef.current = setInterval(async () => {
          try {
            const { data: statusData, error: statusError } = await getBatchStatus({ path: { batchId } });
            if (statusError || !statusData) {
              stopPolling();
              setStatus({ state: 'error', batchId, message: 'батч не найден на сервере' });
              return;
            }
            const s = statusData as BatchStatus;
            if (s.failed.length > 0) {
              stopPolling();
              setStatus({ state: 'error', batchId, message: s.failed[0]?.error ?? 'генерация завершилась с ошибкой' });
              return;
            }
            if (s.done) {
              stopPolling();
              const raw = s.completed[0]?.result;
              if (!raw) {
                setStatus({ state: 'error', batchId, message: 'пустой результат генерации' });
                return;
              }
              try {
                const outline = parseStoryOutline(raw);
                setStoryOutline(outline);
                setStatus({ state: 'done', outline, rawJson: raw, batchId });
              } catch (parseErr) {
                setStatus({
                  state: 'error',
                  batchId,
                  message: parseErr instanceof Error ? parseErr.message : String(parseErr),
                });
              }
              return;
            }
          } catch (e) {
            stopPolling();
            setStatus({ state: 'error', batchId, message: e instanceof Error ? e.message : 'сервер недоступен' });
          }
        }, 2000);
      } catch (e) {
        setStatus({ state: 'error', message: e instanceof Error ? e.message : 'непредвиденная ошибка' });
      }
    },
    [stopPolling, setStoryOutline],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus({ state: 'idle' });
    setStoryOutline(null);
  }, [stopPolling, setStoryOutline]);

  return { status, generate, reset };
}
