import { useCallback, useEffect, useRef, useState } from 'react';
import { generateSegment, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, GeneratedSegment, OutlinePlan, SegmentIssue } from './types';
import { parseGeneratedSegment, validateGeneratedSegment } from './types';
import { buildSegmentRequestPayload } from './buildSegmentRequest';
import { validateSegmentSemantics } from './validateSegment';
import { useNarrativeStore } from './narrativeStore';

export type SegmentGenStatus =
  | { state: 'idle' }
  | { state: 'generating'; batchId: string; fromId: string; toId: string }
  | {
      state: 'done';
      batchId: string;
      fromId: string;
      toId: string;
      segment: GeneratedSegment;
      issues: SegmentIssue[];
      rawJson: string;
    }
  | { state: 'error'; message: string; fromId: string; toId: string; batchId?: string };

/**
 * Хук жизненного цикла генерации одного сегмента (anchorFrom → anchorTo).
 * Поведение симметрично useOutlineGeneration: kickoff -> 2с polling -> parse + validate.
 */
export function useSegmentGeneration() {
  const [status, setStatus] = useState<SegmentGenStatus>({ state: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setSegmentInStore = useNarrativeStore(s => s.setSegment);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const generate = useCallback(
    async (
      brief: Brief,
      outline: OutlinePlan,
      fromId: string,
      toId: string,
      retry?: { previousAttempt: GeneratedSegment; previousIssues: SegmentIssue[] },
    ) => {
      stopPolling();
      setStatus({ state: 'generating', batchId: '', fromId, toId });

      try {
        const payload = buildSegmentRequestPayload(brief, outline, fromId, toId);
        // openapi-схема mark-ит archetypeProfile как nullable, но генератор
        // выдаёт его как optional (T | undefined) без null. Конвертируем null -> undefined.
        const body = {
          ...payload,
          archetypeProfile: payload.archetypeProfile ?? undefined,
          previousAttempt: retry?.previousAttempt ?? undefined,
          previousIssues: retry
            ? retry.previousIssues.map(it => `[${it.severity}] ${it.scope}: ${it.message}`)
            : undefined,
        };
        const { data, error } = await generateSegment({ body });

        if (error || !data) {
          setStatus({
            state: 'error',
            fromId,
            toId,
            message:
              typeof error === 'object' &&
              error &&
              'error' in error &&
              typeof (error as { error: unknown }).error === 'string'
                ? (error as { error: string }).error
                : 'не удалось запустить генерацию сегмента',
          });
          return;
        }
        const batchId = data.batchId;
        setStatus({ state: 'generating', batchId, fromId, toId });

        intervalRef.current = setInterval(async () => {
          try {
            const { data: statusData, error: statusError } = await getBatchStatus({ path: { batchId } });
            if (statusError || !statusData) {
              stopPolling();
              setStatus({ state: 'error', batchId, fromId, toId, message: 'батч не найден' });
              return;
            }
            const s = statusData as BatchStatus;
            if (s.failed.length > 0) {
              stopPolling();
              setStatus({
                state: 'error',
                batchId,
                fromId,
                toId,
                message: s.failed[0]?.error ?? 'генерация завершилась с ошибкой',
              });
              return;
            }
            if (s.done) {
              stopPolling();
              const raw = s.completed[0]?.result;
              if (!raw) {
                setStatus({ state: 'error', batchId, fromId, toId, message: 'пустой результат' });
                return;
              }
              try {
                const segment = parseGeneratedSegment(raw);
                const issues: SegmentIssue[] = [
                  ...validateGeneratedSegment(segment),
                  ...validateSegmentSemantics(segment, {
                    anchorFrom: payload.anchorFrom,
                    anchorTo: payload.anchorTo,
                    archetype: payload.archetypeProfile,
                  }),
                ];
                setSegmentInStore(fromId, toId, segment);
                setStatus({
                  state: 'done',
                  batchId,
                  fromId,
                  toId,
                  segment,
                  issues,
                  rawJson: raw,
                });
              } catch (parseErr) {
                setStatus({
                  state: 'error',
                  batchId,
                  fromId,
                  toId,
                  message: parseErr instanceof Error ? parseErr.message : String(parseErr),
                });
              }
            }
          } catch (e) {
            stopPolling();
            setStatus({
              state: 'error',
              batchId,
              fromId,
              toId,
              message: e instanceof Error ? e.message : 'сервер недоступен',
            });
          }
        }, 2000);
      } catch (e) {
        setStatus({
          state: 'error',
          fromId,
          toId,
          message: e instanceof Error ? e.message : 'непредвиденная ошибка',
        });
      }
    },
    [stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus({ state: 'idle' });
  }, [stopPolling]);

  return { status, generate, reset };
}
