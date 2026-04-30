import { useCallback, useRef, useState } from 'react';
import { generateBackground, getBatchStatus, type BatchStatus } from '@root/image_gen/generated_client';
import type { AnchorPlan, Brief, OutlinePlan } from './types';
import { useNarrativeStore } from './narrativeStore';

/**
 * Bulk-генератор фонов для всех якорей outline-а через image_gen-сервис.
 *
 *   - Один POST /generate/background на якорь
 *   - Concurrency = 3 (image-gen на порядок медленнее текста, ~30-60с/штуку)
 *   - Polling 2с, timeout 5 минут на батч
 *   - Skip уже сгенерированных (resumable)
 *   - Failed не останавливает остальные
 *
 * Описание сцены строится из anchor.summary + контекста брифа.
 * masterPrompt — из brief.artStyle (referenceDescriptor + tone).
 *
 * Сцены сегментов (DraftScene) image_gen НЕ генерируются — они наследуют
 * фон якоря-источника при экспорте в .gu.json (см. convertToGameProject).
 */

const CONCURRENCY = 3;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 300_000; // 5 минут

export type ImageBulkFailure = { anchorId: string; error: string };

export type ImageBulkStatus =
  | { state: 'idle' }
  | {
      state: 'running';
      total: number;
      completed: number;
      inFlight: number;
      remaining: number;
      failures: ImageBulkFailure[];
      cancelled: boolean;
    }
  | {
      state: 'done';
      total: number;
      completed: number;
      failures: ImageBulkFailure[];
      cancelled: boolean;
    };

function buildMasterPrompt(brief: Brief): string {
  const parts: string[] = [];
  if (brief.artStyle.referenceDescriptor) parts.push(brief.artStyle.referenceDescriptor);
  if (brief.world.tone.mood) parts.push(`mood: ${brief.world.tone.mood}`);
  if (brief.world.tone.intensity != null) {
    parts.push(brief.world.tone.intensity < 0.4 ? 'soft cozy lighting' : 'dramatic lighting');
  }
  return parts.join(', ') || 'high quality digital art';
}

function buildSceneDescription(anchor: AnchorPlan, brief: Brief): string {
  const place = brief.world.setting.place;
  const era = brief.world.setting.era;
  const specifics = brief.world.setting.specifics;
  const summary = anchor.summary?.trim() ?? '';
  // Анкер summary обычно описывает что происходит — это уже содержит
  // достаточно деталей про место. Контекст брифа добавляем как «обвязку».
  const ctx = [place, era, specifics].filter(Boolean).join(', ');
  return [summary, ctx ? `Setting: ${ctx}` : ''].filter(Boolean).join('\n').slice(0, 1200); // отрезаем чтобы не превысить размер промпта
}

function buildStoryContext(brief: Brief, outline: OutlinePlan): string {
  return [
    outline.title ? `Title: ${outline.title}` : '',
    outline.logline ? `Logline: ${outline.logline}` : '',
    `Tone: ${brief.world.tone.mood}${
      brief.world.tone.themes.length ? ', themes: ' + brief.world.tone.themes.join(', ') : ''
    }`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function useBulkImageGeneration() {
  const [status, setStatus] = useState<ImageBulkStatus>({ state: 'idle' });
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const start = useCallback(async (brief: Brief, outline: OutlinePlan) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;

    const existing = useNarrativeStore.getState().images;
    const queue: AnchorPlan[] = outline.anchors.filter(
      a => !existing[a.id] || existing[a.id].status === 'failed' || existing[a.id].status === 'pending',
    );

    const total = queue.length;
    let completed = 0;
    let inFlight = 0;
    const failures: ImageBulkFailure[] = [];

    if (total === 0) {
      setStatus({ state: 'done', total: 0, completed: 0, failures: [], cancelled: false });
      runningRef.current = false;
      return;
    }

    const masterPrompt = buildMasterPrompt(brief);
    const storyContext = buildStoryContext(brief, outline);

    const publish = () => {
      setStatus({
        state: 'running',
        total,
        completed,
        inFlight,
        remaining: queue.length,
        failures: failures.slice(),
        cancelled: cancelledRef.current,
      });
    };

    const setStore = useNarrativeStore.getState().setImage;

    const processOne = async (anchor: AnchorPlan): Promise<void> => {
      inFlight++;
      setStore(anchor.id, { status: 'pending' });
      publish();
      try {
        const sceneDescription = buildSceneDescription(anchor, brief);
        const { data, error } = await generateBackground({
          body: {
            masterPrompt,
            storyMasterPrompt: storyContext || undefined,
            sceneDescription,
          },
        });
        if (error || !data) {
          throw new Error('не удалось запустить генерацию');
        }
        const batchId = data.batchId;
        setStore(anchor.id, { status: 'generating', batchId });

        const filename = await pollUntilDone(batchId);
        setStore(anchor.id, { status: 'done', filename });
        completed++;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        failures.push({ anchorId: anchor.id, error });
        setStore(anchor.id, { status: 'failed', error });
      } finally {
        inFlight--;
        publish();
      }
    };

    const worker = async () => {
      while (queue.length > 0 && !cancelledRef.current) {
        const item = queue.shift()!;
        await processOne(item);
      }
    };

    publish();

    const workers: Promise<void>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());

    await Promise.all(workers);

    setStatus({
      state: 'done',
      total,
      completed,
      failures,
      cancelled: cancelledRef.current,
    });
    runningRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setStatus({ state: 'idle' });
  }, []);

  return { status, start, cancel, reset };
}

async function pollUntilDone(batchId: string): Promise<string> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('timeout: image-batch не завершился за 5 минут');
    }
    await sleep(POLL_INTERVAL_MS);
    const { data, error } = await getBatchStatus({ path: { batchId } });
    if (error || !data) throw new Error('image-batch не найден на сервере');
    const s = data as BatchStatus;
    if (s.failed.length > 0) {
      throw new Error(s.failed[0]?.error ?? 'image generation failed');
    }
    if (s.done) {
      const filename = s.completed[0]?.file;
      if (!filename) throw new Error('пустой результат image-batch');
      return filename;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
