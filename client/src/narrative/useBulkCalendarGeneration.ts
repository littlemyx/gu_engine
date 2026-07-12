import { useCallback, useRef, useState } from 'react';
import {
  generateDialogueQa,
  generateDialogueUnit,
  generateSpine,
  generateWorldCalendar,
  getBatchStatus,
  type BatchStatus,
} from '@root/text_gen/generated_client';
import type { Brief, DialogueVariantBracket, LoveInterestCard, SegmentIssue, WorldLocation, WorldModel } from './types';
import { parseWorldModel } from './types';
import type { Calendar, CastPlan, SpinePlan } from './calendarTypes';
import { parseCalendar, parseSpinePlan } from './calendarTypes';
import type { DialogueUnit } from './dialogueUnit';
import { parseDialogueUnit, validateDialogueUnit } from './dialogueUnit';
import { buildDialogueUnitRequestPayload, buildLiCardSummary } from './buildDialogueUnitRequest';
import { validateCalendar } from './validateCalendar';
import { validateSpine, guardFlags } from './validateSpine';
import { buildScheduleStub } from './beatSchedule';
import { buildStubCastPlan } from './castPlanStub';
import { buildWorldCalendarRequestPayload } from './buildWorldCalendarRequest';
import { buildSpineRequestPayload } from './buildSpineRequest';
import { useNarrativeStore } from './narrativeStore';

/**
 * Оркестрация календарного пайплайна (фазы 1+3 docs/plans/calendar-branching.md):
 * cast (стаб без LLM) → world_calendar (LLM) → spine (LLM) → schedule (стаб)
 * → dialogue_units (LLM: LI × 3 брекета, structural validate + dialogueQA-критик).
 *
 * Механика LLM-стадий скопирована с worldModel-фазы useBulkStoryGeneration:
 * endpoint → polling /status/:batchId, best-of retry ≤3 попыток с фидбеком
 * previousAttempt/previousIssues из ошибок валидатора. Валидные кэшированные
 * артефакты (против ТЕКУЩИХ входов) не регенерируются — деньги уходят только
 * на отсутствующее и невалидное.
 *
 * В отличие от useBulkStoryGeneration стадии не деградируют: без календаря
 * нет хребта, без хребта нет расписания, поэтому фейл стадии останавливает
 * прогон с error + issues (кнопка «повторить» у вызывающего — просто run()).
 */

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;
const MAX_ATTEMPTS = 3;
const TOTAL_STEPS = 5;
const BRACKETS: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];

export type BulkCalendarPhase = 'idle' | 'cast' | 'world_calendar' | 'spine' | 'schedule' | 'dialogue_units' | 'done';

export type BulkCalendarProgress = { completed: number; total: number };

/** Артефакт стадии worldCalendar целиком (пишется в стор одним сеттером). */
type WorldCalendarArtifact = {
  world: WorldModel;
  calendar: Calendar;
  tagMap: Record<string, string[]>;
};

export function useBulkCalendarGeneration() {
  const [phase, setPhase] = useState<BulkCalendarPhase>('idle');
  const [progress, setProgress] = useState<BulkCalendarProgress>({ completed: 0, total: TOTAL_STEPS });
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const runningRef = useRef(false);

  const run = useCallback(async (brief: Brief) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    setIssues([]);

    const publish = (p: BulkCalendarPhase, completed: number) => {
      setPhase(p);
      setProgress({ completed, total: TOTAL_STEPS });
    };

    const fail = (p: BulkCalendarPhase, message: string, stageIssues: string[] = []) => {
      setPhase(p);
      setError(message);
      setIssues(stageIssues);
      runningRef.current = false;
    };

    // ── Phase 1: cast — детерминированный стаб, без LLM. ────────────────────
    // Перегенерация только при отсутствии плана или смене состава LI: setCastPlan
    // каскадно сбрасывает календарь и всё ниже, зря дёргать её нельзя.
    publish('cast', 0);
    {
      const cached = useNarrativeStore.getState().castPlan;
      if (!cached || !sameCastMembers(cached, brief)) {
        useNarrativeStore.getState().setCastPlan(buildStubCastPlan(brief));
      }
    }
    const castPlan = useNarrativeStore.getState().castPlan;

    // ── Phase 2: world_calendar — мир + календарь + маппинг тегов. ──────────
    publish('world_calendar', 1);
    {
      const store = useNarrativeStore.getState();
      const artifactErrors = (a: WorldCalendarArtifact): string[] =>
        validateCalendar(a.calendar, brief, a.world, a.tagMap, castPlan)
          .filter(i => i.severity === 'error')
          .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);

      const cached: WorldCalendarArtifact | null =
        store.worldModel && store.calendar && store.tagMap
          ? { world: store.worldModel, calendar: store.calendar, tagMap: store.tagMap }
          : null;
      const cachedErrors = cached ? artifactErrors(cached) : [];

      if (!cached || cachedErrors.length > 0) {
        try {
          const basePayload = buildWorldCalendarRequestPayload(brief, castPlan);
          let best: { artifact: WorldCalendarArtifact; errorCount: number; errors: string[] } | null =
            cached && cachedErrors.length > 0
              ? { artifact: cached, errorCount: cachedErrors.length, errors: cachedErrors }
              : null;
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              type WorldCalendarPayload = typeof basePayload & {
                previousAttempt?: ReturnType<typeof worldCalendarToAttempt>;
                previousIssues?: string[];
              };
              const payload: WorldCalendarPayload = !best
                ? basePayload
                : {
                    ...basePayload,
                    previousAttempt: worldCalendarToAttempt(best.artifact),
                    previousIssues: best.errors,
                  };
              const { data, error: reqError } = await generateWorldCalendar({ body: payload });
              if (reqError || !data) throw new Error('не удалось запустить построение мира и календаря');
              const artifact = await pollBatchResult(data.batchId, parseWorldCalendarResult);
              const errors = artifactErrors(artifact);
              if (!best || errors.length < best.errorCount) {
                best = { artifact, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (best && best.errorCount === 0) {
            useNarrativeStore
              .getState()
              .setWorldCalendar(best.artifact.world, best.artifact.calendar, best.artifact.tagMap);
          } else if (!best && lastAttemptError) {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          } else {
            fail(
              'world_calendar',
              `мир и календарь не прошли валидацию (${best?.errorCount ?? '?'} ошибок)`,
              best?.errors ?? [],
            );
            return;
          }
        } catch (e) {
          fail('world_calendar', e instanceof Error ? e.message : String(e));
          return;
        }
      }
    }
    const { worldModel, calendar, tagMap } = useNarrativeStore.getState();
    if (!worldModel || !calendar) {
      fail('world_calendar', 'стадия worldCalendar не оставила артефактов в сторе');
      return;
    }

    // ── Phase 3: spine — хребет с окнами слотов и концовками. ───────────────
    publish('spine', 2);
    {
      const spineErrors = (s: SpinePlan): string[] =>
        validateSpine(s, calendar, brief, worldModel)
          .filter(i => i.severity === 'error')
          .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);

      const cachedSpine = useNarrativeStore.getState().spine;
      const cachedSpineErrors = cachedSpine ? spineErrors(cachedSpine) : [];

      if (!cachedSpine || cachedSpineErrors.length > 0) {
        try {
          const basePayload = buildSpineRequestPayload(brief, worldModel, calendar, tagMap);
          let best: { plan: SpinePlan; errorCount: number; errors: string[] } | null =
            cachedSpine && cachedSpineErrors.length > 0
              ? { plan: cachedSpine, errorCount: cachedSpineErrors.length, errors: cachedSpineErrors }
              : null;
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              type SpinePayload = typeof basePayload & {
                previousAttempt?: ReturnType<typeof spineToAttempt>;
                previousIssues?: string[];
              };
              const payload: SpinePayload = !best
                ? basePayload
                : { ...basePayload, previousAttempt: spineToAttempt(best.plan), previousIssues: best.errors };
              const { data, error: reqError } = await generateSpine({ body: payload });
              if (reqError || !data) throw new Error('не удалось запустить генерацию хребта');
              const plan = await pollBatchResult(data.batchId, parseSpinePlan);
              const errors = spineErrors(plan);
              if (!best || errors.length < best.errorCount) {
                best = { plan, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (best && best.errorCount === 0) {
            useNarrativeStore.getState().setSpine(best.plan);
          } else if (!best && lastAttemptError) {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          } else {
            fail('spine', `хребет не прошёл валидацию (${best?.errorCount ?? '?'} ошибок)`, best?.errors ?? []);
            return;
          }
        } catch (e) {
          fail('spine', e instanceof Error ? e.message : String(e));
          return;
        }
      }
    }
    const spine = useNarrativeStore.getState().spine;
    if (!spine) {
      fail('spine', 'стадия spine не оставила хребта в сторе');
      return;
    }

    // ── Phase 4: schedule — детерминированный стаб, без LLM. ────────────────
    // setSchedule сбрасывает eventUnits/unitProse, поэтому существующее
    // расписание (spine не менялся — иначе setSpine его бы снёс) не трогаем.
    publish('schedule', 3);
    if (!useNarrativeStore.getState().schedule) {
      useNarrativeStore.getState().setSchedule(buildScheduleStub(brief, spine, calendar, castPlan, tagMap));
    }
    const schedule = useNarrativeStore.getState().schedule;
    if (!schedule) {
      fail('schedule', 'стадия schedule не оставила расписания в сторе');
      return;
    }

    // ── Phase 5: dialogue_units — LI × 3 брекета (фаза 3 плана). ────────────
    // Структурный validateDialogueUnit гейтит best-of retry (≤MAX_ATTEMPTS с
    // previousIssues-фидбеком); поверх структурно валидного юнита — ОДИН
    // dialogueQA-проход (LLM-критик: ответы на ask, тон=брекету, завершённость
    // closing); error-severity QA-issues дают одну дополнительную попытку
    // регенерации. Кэш: LI с 3 юнитами, валидными против текущих входов,
    // пропускается (деньги — только на отсутствующее и невалидное).
    publish('dialogue_units', 4);
    {
      const stageIssues: string[] = [];

      for (const li of brief.loveInterests) {
        const unitKey = `enc_${li.id}`;
        const unitErrors = (u: DialogueUnit): string[] =>
          validateDialogueUnit(u, li.id)
            .filter(i => i.severity === 'error')
            .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);

        const cached = useNarrativeStore.getState().unitProse[unitKey] ?? [];
        const cachedComplete =
          cached.length === 3 &&
          BRACKETS.every(b => {
            const u = cached.find(x => x.bracket === b);
            return u != null && unitErrors(u).length === 0;
          });
        if (cachedComplete) continue;

        const units: DialogueUnit[] = [];
        for (const bracket of BRACKETS) {
          // Валидный кэшированный брекет не трогаем.
          const cachedForBracket = cached.find(u => u.bracket === bracket);
          if (cachedForBracket && unitErrors(cachedForBracket).length === 0) {
            units.push(cachedForBracket);
            continue;
          }

          try {
            const basePayload = buildDialogueUnitRequestPayload(
              brief,
              li,
              bracket,
              calendar,
              schedule,
              worldModel,
              spine,
            );
            type UnitPayload = typeof basePayload & { previousAttempt?: DialogueUnit; previousIssues?: string[] };
            const generateOnce = async (
              prev: { unit: DialogueUnit; errors: string[] } | null,
            ): Promise<DialogueUnit> => {
              const payload: UnitPayload = !prev
                ? basePayload
                : { ...basePayload, previousAttempt: prev.unit, previousIssues: prev.errors };
              const { data, error: reqError } = await generateDialogueUnit({ body: payload });
              if (reqError || !data) throw new Error(`не удалось запустить генерацию юнита bracket=${bracket}`);
              return pollBatchResult(data.batchId, parseDialogueUnit);
            };

            // Невалидный кэш сидирует best — его ошибки уходят фидбеком.
            let best: { unit: DialogueUnit; errorCount: number; errors: string[] } | null =
              cachedForBracket != null
                ? {
                    unit: cachedForBracket,
                    errorCount: unitErrors(cachedForBracket).length,
                    errors: unitErrors(cachedForBracket),
                  }
                : null;
            let lastAttemptError: unknown = null;
            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
              try {
                const unit = await generateOnce(
                  best && best.errorCount > 0 ? { unit: best.unit, errors: best.errors } : null,
                );
                const errors = unitErrors(unit);
                if (!best || errors.length < best.errorCount) {
                  best = { unit, errorCount: errors.length, errors };
                }
                if (errors.length === 0) break;
              } catch (attemptErr) {
                lastAttemptError = attemptErr;
              }
            }
            if (!best) {
              throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
            }

            // Один QA-проход поверх структурно валидного юнита. Недоступность
            // критика не блокирует пайплайн — QA best-effort по дизайну D1.
            if (best.errorCount === 0) {
              try {
                const qaErrors = (await runDialogueQA(best.unit, bracket, li))
                  .filter(i => i.severity === 'error')
                  .map(i => `[QA] ${i.scope}: ${i.message}`);
                if (qaErrors.length > 0) {
                  // Одна дополнительная регенерация с QA-фидбеком; берём
                  // новый юнит только если он структурно чист.
                  try {
                    const regen = await generateOnce({ unit: best.unit, errors: qaErrors });
                    if (unitErrors(regen).length === 0) {
                      best = { unit: regen, errorCount: 0, errors: [] };
                    }
                  } catch {
                    // Оставляем исходный структурно валидный юнит.
                  }
                }
              } catch {
                // QA-критик недоступен — юнит уже структурно валиден.
              }
            }

            units.push(best.unit);
            if (best.errorCount > 0) {
              stageIssues.push(`${li.id}/${bracket}: сохранён с ошибками: ${best.errors.slice(0, 2).join('; ')}`);
            }
          } catch (e) {
            stageIssues.push(`${li.id}/${bracket}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        if (units.length > 0) {
          useNarrativeStore.getState().setUnitProse(unitKey, units);
        }
      }

      if (stageIssues.length > 0) {
        fail('dialogue_units', `диалоговые юниты не собраны полностью (${stageIssues.length} проблем)`, stageIssues);
        return;
      }
    }

    publish('done', TOTAL_STEPS);
    runningRef.current = false;
  }, []);

  return { run, phase, progress, error, issues };
}

/** Состав LI не изменился относительно castPlan (id-множества совпадают). */
function sameCastMembers(plan: CastPlan, brief: Brief): boolean {
  const planIds = plan.members.map(m => m.id).sort();
  const briefIds = brief.loveInterests.map(li => li.id).sort();
  return planIds.length === briefIds.length && planIds.every((id, i) => id === briefIds[i]);
}

/**
 * Ответ стадии worldCalendar → артефакты. Коэрсия локаций (mood/specialKind →
 * дефолты) реюзается из parseWorldModel; якорей у календарного мира нет,
 * поэтому anchorLocations — пустой объект.
 */
function parseWorldCalendarResult(raw: string): WorldCalendarArtifact {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`worldCalendar JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (!Array.isArray(obj.locations) || !obj.calendar || !obj.tagMap || typeof obj.tagMap !== 'object') {
    throw new Error('worldCalendar response missing locations, calendar or tagMap');
  }
  const world = parseWorldModel(JSON.stringify({ locations: obj.locations, anchorLocations: {} }));
  const calendar = parseCalendar(obj.calendar);
  const tagMap: Record<string, string[]> = {};
  for (const [tag, ids] of Object.entries(obj.tagMap as Record<string, unknown>)) {
    tagMap[tag] = Array.isArray(ids) ? ids.map(id => String(id)).filter(Boolean) : [];
  }
  return { world, calendar, tagMap };
}

/** Артефакт → LLM-контракт worldCalendar (для previousAttempt-фидбека). */
function worldCalendarToAttempt(a: WorldCalendarArtifact): {
  locations: WorldLocation[];
  calendar: Calendar;
  tagMap: Record<string, string[]>;
} {
  return { locations: a.world.locations, calendar: a.calendar, tagMap: a.tagMap };
}

/**
 * SpinePlan → LLM-контракт spine (для previousAttempt-фидбека): guard-ы
 * разворачиваются обратно в плоские requires, иначе модель начнёт подражать
 * внутренней рекурсивной грамматике Guard вместо контракта.
 */
function spineToAttempt(spine: SpinePlan): Record<string, unknown> {
  return {
    title: spine.title,
    logline: spine.logline,
    beats: spine.beats.map(b => ({
      id: b.id,
      kind: b.kind,
      act: b.act,
      window: b.window,
      locationId: b.locationId,
      participants: b.participants,
      summary: b.summary,
      establishes: b.establishes,
      requires: guardFlags(b.guard),
      ...(b.outcomes ? { outcomes: b.outcomes } : {}),
    })),
    endings: spine.endings.map(e => ({
      id: e.id,
      kind: e.kind,
      liId: e.liId,
      requires: guardFlags(e.guard),
    })),
  };
}

/**
 * QA-request builder инлайном: юнит + брекет + выжимка карточки LI →
 * issues LLM-критика (D1). Ответ — строгий JSON {"issues": [...]}.
 */
async function runDialogueQA(
  unit: DialogueUnit,
  bracket: DialogueVariantBracket,
  li: LoveInterestCard,
): Promise<SegmentIssue[]> {
  const { data, error } = await generateDialogueQa({
    body: { unit, bracket, liCardSummary: buildLiCardSummary(li) },
  });
  if (error || !data) throw new Error('не удалось запустить dialogueQA');
  return pollBatchResult(data.batchId, parseDialogueQAIssues);
}

function parseDialogueQAIssues(raw: string): SegmentIssue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`dialogueQA JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (!Array.isArray(obj.issues)) throw new Error('dialogueQA response missing issues array');
  return (obj.issues as unknown[]).map(i => {
    const issue = i as Record<string, unknown>;
    return {
      severity: issue.severity === 'error' ? 'error' : 'warning',
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
    await sleep(POLL_INTERVAL_MS);
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
