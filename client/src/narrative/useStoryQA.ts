import { useCallback } from 'react';
import { generateStoryLeafQa, getBatchStatus, type BatchStatus } from '@root/text_gen/generated_client';
import type { Brief, SegmentIssue } from './types';
import type { StoryQAInputs, StoryQAStatus } from './storyQA';
import { buildStoryLeafQARequests, runStoryQAStructural, simulatePolicies, summarizePolicyReports } from './storyQA';
import { useNarrativeStore } from './narrativeStore';

export type { StoryQAState, StoryQAStatus } from './storyQA';

/**
 * Оркестрация story QA (фаза 6): структурный отчёт (D2, sync) + симуляция
 * политик (D3, sync) + LLM-критик листьев (D4, async через text_gen,
 * ≤MAX_LEAF_QA_CALLS вызовов). Недоступность text_gen НЕ валит прогон —
 * детерминированные проверки ценны сами по себе, критик деградирует в warning.
 *
 * Отчёт живёт в narrativeStore (персистится): переходы между секциями,
 * уход на канвас и reload его не теряют. Зависший state='running' после
 * reload санитизирует initNarrative. Хук — тонкий view-адаптер.
 */

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;

const IDLE_STATUS: StoryQAStatus = { state: 'idle', issues: [], policyReports: [] };

/** Прогон QA идёт в этой вкладке — второй запуск игнорируется. */
let running = false;

export async function runStoryQA(brief: Brief): Promise<void> {
  if (running) return;
  running = true;
  const setStatus = (status: StoryQAStatus) => useNarrativeStore.getState().setStoryQA(status);
  try {
    setStatus({ state: 'running', issues: [], policyReports: [] });

    const s = useNarrativeStore.getState();
    if (!s.calendar || !s.spine || !s.schedule) {
      setStatus({
        state: 'done',
        issues: [
          {
            severity: 'error',
            scope: 'qa/inputs',
            message: 'календарный стек не готов (нужны calendar + spine + schedule) — сгенерируйте пайплайн',
          },
        ],
        policyReports: [],
      });
      return;
    }

    const inputs: StoryQAInputs = {
      brief,
      calendar: s.calendar,
      spine: s.spine,
      schedule: s.schedule,
      castPlan: s.castPlan,
      tagMap: s.tagMap,
      worldModel: s.worldModel,
      eventUnits: Object.values(s.eventUnits),
      unitProse: s.unitProse,
    };

    // D2 + D3 — синхронно и детерминированно.
    const issues: SegmentIssue[] = runStoryQAStructural(inputs);
    const policyReports = simulatePolicies(inputs);
    issues.push(...summarizePolicyReports(policyReports));

    // D4 — критик листьев, best-effort: text_gen недоступен → один warning.
    for (const payload of buildStoryLeafQARequests(inputs)) {
      try {
        const { data, error } = await generateStoryLeafQa({ body: payload });
        if (error || !data) throw new Error('не удалось запустить критика листа');
        const leafIssues = await pollBatchResult(data.batchId, parseIssues);
        issues.push(...leafIssues.map(i => ({ ...i, scope: `leaf/${payload.leafLabel}/${i.scope}` })));
      } catch (e) {
        issues.push({
          severity: 'warning',
          scope: `leaf/${payload.leafLabel}`,
          message: `критик листа пропущен: ${e instanceof Error ? e.message : String(e)} (text_gen недоступен?)`,
        });
        break; // сервис лежит — остальные листья не мучаем
      }
    }

    setStatus({ state: 'done', issues, policyReports });
  } finally {
    running = false;
  }
}

export function useStoryQA() {
  const status = useNarrativeStore(s => s.storyQA ?? IDLE_STATUS);
  const run = useCallback((brief: Brief) => runStoryQA(brief), []);
  return { run, status };
}

function parseIssues(raw: string): SegmentIssue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`storyLeafQA JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (!Array.isArray(obj.issues)) throw new Error('storyLeafQA response missing issues array');
  return (obj.issues as unknown[]).map(i => {
    const issue = i as Record<string, unknown>;
    return {
      severity: issue.severity === 'error' ? ('error' as const) : ('warning' as const),
      scope: String(issue.scope ?? ''),
      message: String(issue.message ?? ''),
    };
  });
}

async function pollBatchResult<T>(batchId: string, parse: (raw: string) => T): Promise<T> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error('timeout');
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    const { data, error } = await getBatchStatus({ path: { batchId } });
    if (error || !data) throw new Error('батч не найден');
    const s = data as BatchStatus;
    if (s.failed.length > 0) throw new Error(s.failed[0]?.error ?? 'ошибка генерации');
    if (s.done) {
      const raw = s.completed[0]?.result;
      if (!raw) throw new Error('пустой результат');
      return parse(raw);
    }
  }
}
