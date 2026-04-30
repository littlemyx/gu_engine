import { useCallback, useEffect, useRef, useState } from 'react';
import { generateOutline, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, OutlinePlan } from './types';
import { parseOutlinePlan } from './types';
import { buildOutlineRequestPayload } from './buildOutlineRequest';
import { useNarrativeStore } from './narrativeStore';

export type OutlineGenStatus =
  | { state: 'idle' }
  | {
      state: 'generating';
      batchId: string;
      pendingCount: number;
      totalCount: number;
    }
  | { state: 'done'; outline: OutlinePlan; rawJson: string; batchId: string }
  | { state: 'error'; message: string; batchId?: string };

/**
 * Хук, инкапсулирующий жизненный цикл генерации outline-а:
 * запуск -> опрос статуса -> парсинг результата.
 *
 * Опрос идёт интервалом 2с (короткий запрос, generation обычно укладывается
 * в 5-15с при использовании gpt-4.1-mini).
 */
export function useOutlineGeneration() {
  const [status, setStatus] = useState<OutlineGenStatus>({ state: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setOutlineInStore = useNarrativeStore(s => s.setOutline);

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
      setStatus({
        state: 'generating',
        batchId: '',
        pendingCount: 1,
        totalCount: 1,
      });

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
        setStatus({
          state: 'generating',
          batchId,
          pendingCount: 1,
          totalCount: 1,
        });

        intervalRef.current = setInterval(async () => {
          try {
            const { data: statusData, error: statusError } = await getBatchStatus({ path: { batchId } });
            if (statusError || !statusData) {
              stopPolling();
              setStatus({
                state: 'error',
                batchId,
                message: 'батч не найден на сервере',
              });
              return;
            }
            const s = statusData as BatchStatus;
            if (s.failed.length > 0) {
              stopPolling();
              setStatus({
                state: 'error',
                batchId,
                message: s.failed[0]?.error ?? 'генерация завершилась с ошибкой',
              });
              return;
            }
            if (s.done) {
              stopPolling();
              const raw = s.completed[0]?.result;
              if (!raw) {
                setStatus({
                  state: 'error',
                  batchId,
                  message: 'пустой результат генерации',
                });
                return;
              }
              try {
                const outline = parseOutlinePlan(raw);
                setOutlineInStore(outline);
                setStatus({
                  state: 'done',
                  outline,
                  rawJson: raw,
                  batchId,
                });
              } catch (parseErr) {
                setStatus({
                  state: 'error',
                  batchId,
                  message: parseErr instanceof Error ? parseErr.message : String(parseErr),
                });
              }
              return;
            }
            // ещё в процессе
            setStatus(prev => ({
              ...prev,
              state: 'generating',
              batchId,
              pendingCount: s.pending.length,
              totalCount: s.total,
            }));
          } catch (e) {
            stopPolling();
            setStatus({
              state: 'error',
              batchId,
              message: e instanceof Error ? e.message : 'сервер недоступен',
            });
          }
        }, 2000);
      } catch (e) {
        setStatus({
          state: 'error',
          message: e instanceof Error ? e.message : 'непредвиденная ошибка',
        });
      }
    },
    [stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus({ state: 'idle' });
    setOutlineInStore(null);
  }, [stopPolling, setOutlineInStore]);

  return { status, generate, reset };
}
