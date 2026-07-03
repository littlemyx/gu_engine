import { useCallback, useRef, useState } from 'react';
import { generateOutline, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, SegmentIssue, StoryOutlinePlan } from './types';
import { parseStoryOutline } from './types';
import { validateStoryOutline } from './validateStoryOutline';
import { buildOutlineRequestPayload } from './buildOutlineRequest';
import { useNarrativeStore } from './narrativeStore';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;
const MAX_ATTEMPTS = 3;

export type StoryOutlineGenStatus =
  | { state: 'idle' }
  | { state: 'generating'; batchId: string; attempt: number }
  | {
      state: 'done';
      outline: StoryOutlinePlan;
      rawJson: string;
      batchId: string;
      /** Остаточные warnings валидации (ошибок нет — иначе был бы error/retry). */
      warnings: SegmentIssue[];
    }
  | { state: 'error'; message: string; batchId?: string };

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollOutlineRaw(batchId: string): Promise<string> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error('timeout');
    await sleep(POLL_INTERVAL_MS);
    const { data, error } = await getBatchStatus({ path: { batchId } });
    if (error || !data) throw new Error('батч не найден на сервере');
    const s = data as BatchStatus;
    if (s.failed.length > 0) throw new Error(s.failed[0]?.error ?? 'генерация завершилась с ошибкой');
    if (s.done) {
      const raw = s.completed[0]?.result;
      if (!raw) throw new Error('пустой результат генерации');
      return raw;
    }
  }
}

export function useStoryOutlineGeneration() {
  const [status, setStatus] = useState<StoryOutlineGenStatus>({ state: 'idle' });
  const runningRef = useRef(false);
  const setStoryOutline = useNarrativeStore(s => s.setStoryOutline);

  const generate = useCallback(
    async (brief: Brief) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setStatus({ state: 'generating', batchId: '', attempt: 1 });

      try {
        const basePayload = buildOutlineRequestPayload(brief);
        let best: {
          outline: StoryOutlinePlan;
          raw: string;
          batchId: string;
          errors: string[];
          warnings: SegmentIssue[];
        } | null = null;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          type OutlinePayload = typeof basePayload & {
            previousAttempt?: StoryOutlinePlan;
            previousIssues?: string[];
          };
          const payload: OutlinePayload =
            attempt === 0 || !best
              ? basePayload
              : { ...basePayload, previousAttempt: best.outline, previousIssues: best.errors };

          const { data, error } = await generateOutline({ body: payload });
          if (error || !data) throw new Error('не удалось запустить генерацию');
          setStatus({ state: 'generating', batchId: data.batchId, attempt: attempt + 1 });

          const raw = await pollOutlineRaw(data.batchId);

          let outline: StoryOutlinePlan;
          try {
            outline = parseStoryOutline(raw);
          } catch (parseErr) {
            // Структурная ошибка ответа — тоже повод для retry-with-feedback:
            // показываем модели её JSON и сообщение парсера.
            const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
            let rawObj: StoryOutlinePlan | undefined;
            try {
              rawObj = JSON.parse(raw) as StoryOutlinePlan;
            } catch {
              rawObj = undefined;
            }
            if (rawObj && (!best || best.errors.length > 0)) {
              best = {
                outline: rawObj,
                raw,
                batchId: data.batchId,
                errors: [`[error] parse: ${msg}`],
                warnings: [],
              };
            }
            continue;
          }

          const issues = validateStoryOutline(outline, brief);
          const errors = issues
            .filter(i => i.severity === 'error')
            .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
          const warnings = issues.filter(i => i.severity === 'warning');

          if (!best || errors.length < best.errors.length) {
            best = { outline, raw, batchId: data.batchId, errors, warnings };
          }
          if (errors.length === 0) break;
        }

        if (!best) throw new Error('генерация не дала результата');
        if (best.errors.length > 0) {
          setStatus({
            state: 'error',
            batchId: best.batchId,
            message: `outline не прошёл валидацию после ${MAX_ATTEMPTS} попыток: ${best.errors.slice(0, 3).join('; ')}`,
          });
          return;
        }

        setStoryOutline(best.outline);
        setStatus({
          state: 'done',
          outline: best.outline,
          rawJson: best.raw,
          batchId: best.batchId,
          warnings: best.warnings,
        });
      } catch (e) {
        setStatus({ state: 'error', message: e instanceof Error ? e.message : 'непредвиденная ошибка' });
      } finally {
        runningRef.current = false;
      }
    },
    [setStoryOutline],
  );

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setStatus({ state: 'idle' });
    setStoryOutline(null);
  }, [setStoryOutline]);

  return { status, generate, reset };
}
