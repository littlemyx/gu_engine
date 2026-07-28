import { useCallback, useEffect, useRef, useState } from 'react';

import { generateBriefFill, generateBriefHintParse, type BriefFillRequest } from '@root/text_gen/generated_client';

import type { BriefDirective } from './briefFields';
import { computeBriefGaps } from './briefGaps';
import { useBriefStore } from './briefStore';
import { buildBriefFillRequestPayload } from './buildBriefFillRequest';
import { buildBriefHintParseRequestPayload } from './buildBriefHintParseRequest';
import { pollBatchResult } from './calendarRunner';
import { addRunCostAmount, BRIEF_GEN_COST_EST } from './costModel';
import { mergeGeneratedBrief } from './mergeGeneratedBrief';
import { appendRunLog } from './runLog';
import type { Brief } from './types';
import { validateBrief } from './validateBrief';

/**
 * Дозаполнение брифа генератором.
 *
 * В отличие от календарного прогона состояние живёт в компоненте, а не в
 * сторе с Web Lock: генерация брифа длится секунды, не переживает перезагрузку
 * и не имеет смысла в фоне — автор всё равно ждёт результат в открытой
 * модалке, чтобы его вычитать.
 */

const MAX_ATTEMPTS = 3;

export type BriefGenPhase = 'idle' | 'parsing_hint' | 'filling' | 'done' | 'error';

export type BriefGeneration = {
  phase: BriefGenPhase;
  /** Номер попытки заполнения, 1..MAX_ATTEMPTS. 0 — ещё не начинали. */
  attempt: number;
  error: string | null;
  /** Сколько полей заполнил последний успешный прогон. */
  filled: number;
  running: boolean;
  /** Есть снимок брифа до генерации — можно откатить. */
  canUndo: boolean;
  generate: (rawText: string, verbosity: number) => Promise<void>;
  cancel: () => void;
  undo: () => void;
};

function parseDirectives(raw: string): BriefDirective[] {
  const parsed = JSON.parse(raw) as { directives?: unknown };
  if (!Array.isArray(parsed.directives)) throw new Error('ответ без directives[]');
  return parsed.directives
    .filter(
      (d): d is BriefDirective =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as BriefDirective).target === 'string' &&
        typeof (d as BriefDirective).instruction === 'string',
    )
    .map(d => ({ target: d.target, instruction: d.instruction }));
}

function parsePatch(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as { patch?: unknown };
  if (!parsed.patch || typeof parsed.patch !== 'object') throw new Error('ответ без patch');
  return parsed.patch as Record<string, unknown>;
}

/** Ошибки итогового брифа — они же фидбек для следующей попытки. */
function briefErrors(brief: Brief): string[] {
  try {
    return validateBrief(brief)
      .filter(i => i.severity === 'error')
      .map(i => `${i.path}: ${i.message}`);
  } catch {
    return ['бриф заполнен не до конца'];
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useBriefGeneration(): BriefGeneration {
  const [phase, setPhase] = useState<BriefGenPhase>('idle');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState(0);
  const [canUndo, setCanUndo] = useState(false);

  const snapshotRef = useRef<Brief | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  // Модалку закрыли — прогон дожёвывать некуда: результат применять уже не в
  // какую форму, а поллинг держал бы вкладку занятой.
  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    runningRef.current = false;
    setPhase('idle');
    setAttempt(0);
  }, []);

  const undo = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;
    useBriefStore.getState().setBrief(snapshot);
    snapshotRef.current = null;
    setCanUndo(false);
    setPhase('idle');
    setFilled(0);
    appendRunLog('info', 'бриф · генерация откачена');
  }, []);

  const generate = useCallback(async (rawText: string, verbosity: number) => {
    if (runningRef.current) return;

    const before = useBriefStore.getState().brief;
    const gaps = computeBriefGaps(before);
    if (gaps.length === 0) {
      setError('в брифе нет пустых полей');
      setPhase('error');
      return;
    }

    runningRef.current = true;
    cancelledRef.current = false;
    snapshotRef.current = before;
    setError(null);
    setFilled(0);
    setAttempt(0);

    const hint = rawText.trim();

    try {
      let directives: BriefDirective[] | null = null;

      if (hint) {
        setPhase('parsing_hint');
        appendRunLog('run', 'бриф · разбор заметок автора');
        const { data, error: httpError } = await generateBriefHintParse({
          body: buildBriefHintParseRequestPayload(hint),
        });
        if (httpError || !data) throw new Error('сервер генерации недоступен');
        directives = await pollBatchResult(data.batchId, parseDirectives);
        addRunCostAmount(BRIEF_GEN_COST_EST.hintParse);
        if (cancelledRef.current) return;
        appendRunLog('info', `бриф · директив из заметок: ${directives.length}`);
      }

      setPhase('filling');

      let best: { brief: Brief; errors: string[] } | null = null;
      let previousAttempt: Record<string, unknown> | null = null;
      let previousIssues: string[] = [];

      for (let n = 1; n <= MAX_ATTEMPTS; n++) {
        if (cancelledRef.current) return;
        setAttempt(n);
        appendRunLog('run', `бриф · заполнение, попытка ${n}/${MAX_ATTEMPTS}`);

        const payload = buildBriefFillRequestPayload(before, gaps, directives, verbosity);
        const body: BriefFillRequest = previousAttempt ? { ...payload, previousAttempt, previousIssues } : payload;
        const { data, error: httpError } = await generateBriefFill({ body });
        if (httpError || !data) throw new Error('сервер генерации недоступен');

        const patch = await pollBatchResult(data.batchId, parsePatch);
        addRunCostAmount(BRIEF_GEN_COST_EST.fill);
        if (cancelledRef.current) return;

        // Сливаем в состояние стора НА ЭТОТ МОМЕНТ, а не в снимок: пока шла
        // генерация, автор мог что-то дописать руками, и это важнее.
        const candidate = mergeGeneratedBrief(useBriefStore.getState().brief, patch, gaps);
        const errors = briefErrors(candidate);

        if (!best || errors.length < best.errors.length) best = { brief: candidate, errors };
        if (errors.length === 0) break;

        previousAttempt = patch;
        previousIssues = errors;
        appendRunLog('error', `бриф · попытка ${n} с ошибками: ${errors[0]}`);
      }

      if (cancelledRef.current || !best) return;

      const remaining = computeBriefGaps(best.brief);
      const filledCount = gaps.length - remaining.filter(g => gaps.includes(g)).length;

      useBriefStore.getState().setBrief(best.brief);
      setFilled(filledCount);
      setCanUndo(true);
      setPhase('done');
      appendRunLog(
        best.errors.length === 0 ? 'ok' : 'error',
        best.errors.length === 0
          ? `бриф · заполнено полей: ${filledCount}`
          : `бриф · заполнено с замечаниями: ${best.errors[0]}`,
      );
    } catch (e) {
      if (cancelledRef.current) return;
      setError(message(e));
      setPhase('error');
      appendRunLog('error', `бриф · генерация не удалась: ${message(e)}`);
    } finally {
      runningRef.current = false;
    }
  }, []);

  return {
    phase,
    attempt,
    error,
    filled,
    running: phase === 'parsing_hint' || phase === 'filling',
    canUndo,
    generate,
    cancel,
    undo,
  };
}
