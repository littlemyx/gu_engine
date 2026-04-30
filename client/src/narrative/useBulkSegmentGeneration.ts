import { useCallback, useRef, useState } from 'react';
import { generateSegment, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, GeneratedSegment, OutlinePlan } from './types';
import { parseGeneratedSegment } from './types';
import { buildSegmentRequestPayload } from './buildSegmentRequest';
import { useNarrativeStore } from './narrativeStore';

/**
 * Bulk-генератор всех сегментов outline-а.
 *
 * Логика:
 *   - Берёт outline.anchorEdges, фильтрует уже сгенерированные (resumable)
 *   - Запускает воркер-пул concurrency=3
 *   - Каждый воркер вытягивает edge из очереди, генерирует сегмент, пишет
 *     в narrativeStore через setSegment, переходит к следующему
 *   - Failed segment не блокирует остальные (записывается в failures)
 *   - cancel() останавливает дозапуск новых работ; in-flight достигают конца
 *
 * Концепт «частичная игра»: после того как часть сегментов сгенерирована,
 * convertToGameProject выдаст работающий проект — на edges без сегментов
 * будут placeholder-переходы. Это позволяет инкрементально доводить игру.
 */

const CONCURRENCY = 3;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

export type BulkFailure = { fromId: string; toId: string; error: string };

export type BulkGenStatus =
  | { state: 'idle' }
  | {
      state: 'running';
      total: number;
      completed: number;
      inFlight: number;
      remaining: number;
      failures: BulkFailure[];
      cancelled: boolean;
    }
  | {
      state: 'done';
      total: number;
      completed: number;
      failures: BulkFailure[];
      cancelled: boolean;
    };

export function useBulkSegmentGeneration() {
  const [status, setStatus] = useState<BulkGenStatus>({ state: 'idle' });
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const start = useCallback(async (brief: Brief, outline: OutlinePlan) => {
    if (runningRef.current) return; // защита от двойного клика
    runningRef.current = true;
    cancelledRef.current = false;

    const existing = useNarrativeStore.getState().segments;
    const queue = outline.anchorEdges
      .filter(e => !existing[`${e.from}->${e.to}`])
      .map(e => ({ fromId: e.from, toId: e.to }));

    const total = queue.length;
    let completed = 0;
    let inFlight = 0;
    const failures: BulkFailure[] = [];

    if (total === 0) {
      setStatus({ state: 'done', total: 0, completed: 0, failures: [], cancelled: false });
      runningRef.current = false;
      return;
    }

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

    const processOne = async (item: { fromId: string; toId: string }): Promise<void> => {
      inFlight++;
      publish();
      try {
        const payload = buildSegmentRequestPayload(brief, outline, item.fromId, item.toId);
        const body = {
          ...payload,
          archetypeProfile: payload.archetypeProfile ?? undefined,
        };
        const { data, error } = await generateSegment({ body });
        if (error || !data) {
          throw new Error('не удалось запустить генерацию');
        }
        const segment = await pollUntilDone(data.batchId);
        useNarrativeStore.getState().setSegment(item.fromId, item.toId, segment);
        completed++;
      } catch (e) {
        failures.push({
          ...item,
          error: e instanceof Error ? e.message : String(e),
        });
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
    if (runningRef.current) return; // нельзя сбросить во время работы
    setStatus({ state: 'idle' });
  }, []);

  return { status, start, cancel, reset };
}

async function pollUntilDone(batchId: string): Promise<GeneratedSegment> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('timeout: батч не завершился за 2 минуты');
    }
    await sleep(POLL_INTERVAL_MS);
    const { data, error } = await getBatchStatus({ path: { batchId } });
    if (error || !data) throw new Error('батч не найден на сервере');
    const s = data as BatchStatus;
    if (s.failed.length > 0) {
      throw new Error(s.failed[0]?.error ?? 'генерация завершилась с ошибкой');
    }
    if (s.done) {
      const raw = s.completed[0]?.result;
      if (!raw) throw new Error('пустой результат');
      return parseGeneratedSegment(raw);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
