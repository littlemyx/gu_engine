import { useCallback, useEffect, useRef, useState } from 'react';

import { generateBriefFill } from '@root/text_gen/generated_client';

import { computeBriefGaps } from '@/narrative/briefGaps';
import { useBriefStore } from '@/narrative/briefStore';
import { buildBriefFillRequestPayload } from '@/narrative/buildBriefFillRequest';
import { pollBatchResult } from '@/narrative/calendarRunner';
import { addRunCostAmount, BRIEF_GEN_COST_EST } from '@/narrative/costModel';
import { mergeGeneratedBrief } from '@/narrative/mergeGeneratedBrief';
import { appendRunLog } from '@/narrative/runLog';

import { roleGapPrefix } from './castingModel';

import type { CastingRole } from './castingModel';

/**
 * Генерация под одну роль кастинг-стола.
 *
 * Это тот же `briefFill`, что дозаполняет бриф целиком, но пробелы сужены до
 * полей этой роли: автор просит придумать LI-3, а не переписать всю историю.
 * Одной попытки достаточно — валидировать весь бриф здесь нечем и незачем,
 * а результат автор видит сразу на карточке.
 */

export type RoleGeneration = {
  /** id роли, которую генерируем прямо сейчас, либо null. */
  busy: string | null;
  error: string | null;
  /** Сколько полей заполнила последняя генерация. */
  filled: number;
  /** id роли, к которой относятся `error`/`filled`. */
  lastRole: string | null;
  generate: (role: CastingRole, verbosity?: number) => Promise<void>;
};

const DEFAULT_VERBOSITY = 3;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function parsePatch(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as { patch?: unknown };
  if (!parsed.patch || typeof parsed.patch !== 'object') throw new Error('ответ без patch');
  return parsed.patch as Record<string, unknown>;
}

/** Пробелы брифа, относящиеся к роли. Пусто — генератору тут делать нечего. */
export function roleGaps(role: CastingRole, gaps: string[]): string[] {
  const prefix = roleGapPrefix(role);
  if (!prefix) return [];
  return gaps.filter(g => g.startsWith(prefix));
}

export function useRoleGeneration(): RoleGeneration {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState(0);
  const [lastRole, setLastRole] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const busyRef = useRef(false);

  // Зона закрыта — ждать ответ некуда: применять его уже не на что.
  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );

  const generate = useCallback(async (role: CastingRole, verbosity = DEFAULT_VERBOSITY) => {
    // Вторая роль в очередь не встаёт: генерации сливаются в один и тот же
    // бриф, и параллельные слияния перетирали бы друг друга.
    if (busyRef.current) return;
    busyRef.current = true;

    setBusy(role.id);
    setLastRole(role.id);
    setError(null);
    setFilled(0);

    const before = useBriefStore.getState().brief;
    const gaps = roleGaps(role, computeBriefGaps(before));

    if (gaps.length === 0) {
      busyRef.current = false;
      setBusy(null);
      setError('у этой роли нет пустых полей — генератору нечего дописывать');
      return;
    }

    try {
      appendRunLog('run', `кастинг · генерация роли «${role.slot}»`);
      const payload = buildBriefFillRequestPayload(before, gaps, null, verbosity);
      const { data, error: httpError } = await generateBriefFill({ body: payload });
      if (httpError || !data) throw new Error('сервер генерации недоступен');

      const patch = await pollBatchResult(data.batchId, parsePatch);
      addRunCostAmount(BRIEF_GEN_COST_EST.fill);
      if (cancelledRef.current) return;

      // Сливаем в бриф НА ЭТОТ МОМЕНТ, а не в снимок: пока шла генерация,
      // автор мог дописать что-то руками, и это важнее.
      const next = mergeGeneratedBrief(useBriefStore.getState().brief, patch, gaps);
      const remaining = computeBriefGaps(next).filter(g => gaps.includes(g));

      useBriefStore.getState().setBrief(next);
      setFilled(gaps.length - remaining.length);
      appendRunLog('ok', `кастинг · роль «${role.slot}»: полей заполнено ${gaps.length - remaining.length}`);
    } catch (e) {
      if (cancelledRef.current) return;
      setError(message(e));
      appendRunLog('error', `кастинг · роль «${role.slot}» не сгенерирована: ${message(e)}`);
    } finally {
      busyRef.current = false;
      if (!cancelledRef.current) setBusy(null);
    }
  }, []);

  return { busy, error, filled, lastRole, generate };
}
