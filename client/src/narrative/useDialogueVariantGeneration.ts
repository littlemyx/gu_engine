import { useCallback, useEffect, useRef, useState } from 'react';
import { generateDialogueVariant, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, LoveInterestCard, StoryAnchor, DialogueVariant, DialogueVariantBracket } from './types';
import { parseDialogueVariant } from './types';
import { buildDialogueVariantRequestPayload } from './buildDialogueVariantRequest';
import { useNarrativeStore } from './narrativeStore';

export type DialogueVariantGenStatus =
  | { state: 'idle' }
  | { state: 'generating'; batchId: string; liId: string; bracket: DialogueVariantBracket }
  | {
      state: 'done';
      batchId: string;
      liId: string;
      bracket: DialogueVariantBracket;
      variant: DialogueVariant;
      rawJson: string;
    }
  | { state: 'error'; message: string; liId: string; bracket: DialogueVariantBracket; batchId?: string };

export function useDialogueVariantGeneration() {
  const [status, setStatus] = useState<DialogueVariantGenStatus>({ state: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setDialogueVariantsInStore = useNarrativeStore(s => s.setDialogueVariants);

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
      li: LoveInterestCard,
      anchor: StoryAnchor,
      bracket: DialogueVariantBracket,
      recentEvents: string,
    ) => {
      stopPolling();
      setStatus({ state: 'generating', batchId: '', liId: li.id, bracket });

      try {
        const payload = buildDialogueVariantRequestPayload(brief, li, anchor, bracket, recentEvents);
        const { data, error } = await generateDialogueVariant({ body: payload });
        if (error || !data) {
          setStatus({
            state: 'error',
            liId: li.id,
            bracket,
            message:
              typeof error === 'object' &&
              error &&
              'error' in error &&
              typeof (error as { error: unknown }).error === 'string'
                ? (error as { error: string }).error
                : 'не удалось запустить генерацию dialogue variant',
          });
          return;
        }
        const batchId = data.batchId;
        setStatus({ state: 'generating', batchId, liId: li.id, bracket });

        intervalRef.current = setInterval(async () => {
          try {
            const { data: statusData, error: statusError } = await getBatchStatus({ path: { batchId } });
            if (statusError || !statusData) {
              stopPolling();
              setStatus({ state: 'error', batchId, liId: li.id, bracket, message: 'батч не найден' });
              return;
            }
            const s = statusData as BatchStatus;
            if (s.failed.length > 0) {
              stopPolling();
              setStatus({
                state: 'error',
                batchId,
                liId: li.id,
                bracket,
                message: s.failed[0]?.error ?? 'ошибка генерации',
              });
              return;
            }
            if (s.done) {
              stopPolling();
              const raw = s.completed[0]?.result;
              if (!raw) {
                setStatus({ state: 'error', batchId, liId: li.id, bracket, message: 'пустой результат' });
                return;
              }
              try {
                const variant = parseDialogueVariant(raw);
                setStatus({ state: 'done', batchId, liId: li.id, bracket, variant, rawJson: raw });
              } catch (parseErr) {
                setStatus({
                  state: 'error',
                  batchId,
                  liId: li.id,
                  bracket,
                  message: parseErr instanceof Error ? parseErr.message : String(parseErr),
                });
              }
            }
          } catch (e) {
            stopPolling();
            setStatus({
              state: 'error',
              batchId,
              liId: li.id,
              bracket,
              message: e instanceof Error ? e.message : 'сервер недоступен',
            });
          }
        }, 2000);
      } catch (e) {
        setStatus({
          state: 'error',
          liId: li.id,
          bracket,
          message: e instanceof Error ? e.message : 'непредвиденная ошибка',
        });
      }
    },
    [stopPolling, setDialogueVariantsInStore],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus({ state: 'idle' });
  }, [stopPolling]);

  return { status, generate, reset };
}
