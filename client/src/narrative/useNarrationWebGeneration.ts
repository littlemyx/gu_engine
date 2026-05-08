import { useCallback, useEffect, useRef, useState } from 'react';
import { generateNarrationWeb, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, NarrationWeb, StoryOutlinePlan, SegmentIssue } from './types';
import { parseNarrationWeb, validateNarrationWeb } from './types';
import { buildNarrationWebRequestPayload } from './buildNarrationWebRequest';
import { useNarrativeStore } from './narrativeStore';

export type NarrationWebGenStatus =
  | { state: 'idle' }
  | { state: 'generating'; batchId: string; fromId: string; toId: string }
  | {
      state: 'done';
      batchId: string;
      fromId: string;
      toId: string;
      web: NarrationWeb;
      issues: SegmentIssue[];
      rawJson: string;
    }
  | { state: 'error'; message: string; fromId: string; toId: string; batchId?: string };

export function useNarrationWebGeneration() {
  const [status, setStatus] = useState<NarrationWebGenStatus>({ state: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setNarrationWebInStore = useNarrativeStore(s => s.setNarrationWeb);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const generate = useCallback(
    async (brief: Brief, outline: StoryOutlinePlan, fromId: string, toId: string) => {
      stopPolling();
      setStatus({ state: 'generating', batchId: '', fromId, toId });

      try {
        const payload = buildNarrationWebRequestPayload(brief, outline, fromId, toId);
        const { data, error } = await generateNarrationWeb({ body: payload });
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
                : 'не удалось запустить генерацию narration web',
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
                const web = parseNarrationWeb(raw);
                const availableLIIds = payload.availableLIs.map(li => li.liId);
                const issues = validateNarrationWeb(web, availableLIIds);
                setNarrationWebInStore(fromId, toId, web);
                setStatus({ state: 'done', batchId, fromId, toId, web, issues, rawJson: raw });
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
        setStatus({ state: 'error', fromId, toId, message: e instanceof Error ? e.message : 'непредвиденная ошибка' });
      }
    },
    [stopPolling, setNarrationWebInStore],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus({ state: 'idle' });
  }, [stopPolling]);

  return { status, generate, reset };
}
