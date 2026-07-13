import { useCallback, useRef, useState } from 'react';
import {
  generateAnchorBeat,
  generateCastPlan,
  generateDialogueQa,
  generateDialogueUnit,
  generateEnding,
  generateEventPool,
  generateSpine,
  generateWorldCalendar,
  getBatchStatus,
  type BatchStatus,
} from '@root/text_gen/generated_client';
import type {
  AnchorBeat,
  Brief,
  DialogueVariantBracket,
  EndingVariant,
  LoveInterestCard,
  SegmentIssue,
  WorldLocation,
  WorldModel,
} from './types';
import {
  endingKey,
  parseAnchorBeat,
  parseEndingVariant,
  parseWorldModel,
  validateAnchorBeat,
  validateEndingVariant,
} from './types';
import type { Calendar, CastPlan, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import { normalizeSpineWindows, parseCalendar, parseCastPlan, parseSpinePlan } from './calendarTypes';
import type { DialogueUnit } from './dialogueUnit';
import { breakDialogueCycles, parseDialogueUnit, validateDialogueUnit } from './dialogueUnit';
import { buildDialogueUnitRequestPayload, buildLiCardSummary } from './buildDialogueUnitRequest';
import { validateCalendar } from './validateCalendar';
import { validateCastPlan } from './validateCastPlan';
import { validateSpine, guardFlags } from './validateSpine';
import { buildSchedule, validateSchedule } from './buildSchedule';
import { buildStubCastPlan } from './castPlanStub';
import { buildCastPlanRequestPayload } from './buildCastPlanRequest';
import { buildWorldCalendarRequestPayload } from './buildWorldCalendarRequest';
import { buildSpineRequestPayload } from './buildSpineRequest';
import { buildEventPoolRequestPayload, parseEventPool, unitEstablishes, validateEventUnits } from './parseEventPool';
import { deriveLegacyOutline } from './deriveLegacyOutline';
import { buildAnchorBeatRequestPayload } from './buildAnchorBeatRequest';
import { buildEndingRequestPayload } from './buildEndingRequest';
import { topoOrderAnchors, outgoingOf } from './anchorOrder';
import { computeReachableUnits } from './reachability';
import { useNarrativeStore } from './narrativeStore';

/**
 * Оркестрация календарного пайплайна (фазы 1+3+4 docs/plans/calendar-branching.md):
 * cast (LLM, фолбэк — стаб) → world_calendar (LLM) → spine (LLM) → schedule
 * (детерминированный солвер buildSchedule) → beat_prose (LLM: проза битов
 * хребта через легаси-стадию anchorBeat поверх deriveLegacyOutline) →
 * event_pool (LLM, per LI) → prune (reachability, без LLM) → dialogue_units
 * (LLM: достижимый юнит × 3 брекета, structural validate + dialogueQA-критик).
 *
 * Механика LLM-стадий скопирована с worldModel-фазы useBulkStoryGeneration:
 * endpoint → polling /status/:batchId, best-of retry ≤3 попыток с фидбеком
 * previousAttempt/previousIssues из ошибок валидатора. Валидные кэшированные
 * артефакты (против ТЕКУЩИХ входов) не регенерируются — деньги уходят только
 * на отсутствующее и невалидное.
 *
 * Деградация: только стадия cast умеет откатиться на детерминированный стаб
 * (buildStubCastPlan) — расписание и пул событий без агенд всё ещё осмысленны.
 * Остальные стадии при фейле останавливают прогон с error + issues
 * (кнопка «повторить» у вызывающего — просто run()).
 */

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;
const MAX_ATTEMPTS = 3;
const TOTAL_STEPS = 9;
const BRACKETS: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];

export type BulkCalendarPhase =
  | 'idle'
  | 'cast'
  | 'world_calendar'
  | 'spine'
  | 'schedule'
  | 'beat_prose'
  | 'event_pool'
  | 'prune'
  | 'dialogue_units'
  | 'ending_prose'
  | 'done';

export type BulkCalendarProgress = { completed: number; total: number };

/**
 * Затравки фидбека от story QA («перегенерировать с фидбеком»): issue-строки
 * вливаются в previousIssues ПЕРВОЙ попытки целевой стадии, а кэшированный
 * артефакт при их наличии считается невалидным — best-of retry регенерирует
 * его с фидбеком, сохранив как previousAttempt (сброс стора не нужен).
 */
export type BulkCalendarRunOptions = {
  seedIssues?: {
    spine?: string[];
    /** unitId → issue-строки для его диалоговой прозы. */
    dialogue?: Record<string, string[]>;
  };
};

/** Артефакт стадии worldCalendar целиком (пишется в стор одним сеттером). */
type WorldCalendarArtifact = {
  world: WorldModel;
  calendar: Calendar;
  tagMap: Record<string, string[]>;
};

const formatIssue = (i: SegmentIssue) => `[${i.severity}] ${i.scope}: ${i.message}`;

export function useBulkCalendarGeneration() {
  const [phase, setPhase] = useState<BulkCalendarPhase>('idle');
  const [progress, setProgress] = useState<BulkCalendarProgress>({ completed: 0, total: TOTAL_STEPS });
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const runningRef = useRef(false);

  const run = useCallback(async (brief: Brief, options?: BulkCalendarRunOptions) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    setIssues([]);

    // Нефатальные проблемы прогона (фолбэк каста, счётчик pruning-а):
    // показываются автору и при успехе, и при фейле.
    const softIssues: string[] = [];

    const publish = (p: BulkCalendarPhase, completed: number) => {
      setPhase(p);
      setProgress({ completed, total: TOTAL_STEPS });
    };

    const fail = (p: BulkCalendarPhase, message: string, stageIssues: string[] = []) => {
      setPhase(p);
      setError(message);
      setIssues([...softIssues, ...stageIssues]);
      runningRef.current = false;
    };

    // ── Phase 1: cast — LLM-агенды; фолбэк — детерминированный стаб. ────────
    // Перегенерация только при отсутствии/невалидности плана или смене состава
    // LI: setCastPlan каскадно сбрасывает календарь и всё ниже.
    publish('cast', 0);
    {
      const castErrors = (p: CastPlan): string[] =>
        validateCastPlan(p, brief)
          .filter(i => i.severity === 'error')
          .map(formatIssue);

      const cached = useNarrativeStore.getState().castPlan;
      const cachedUsable = cached != null && sameCastMembers(cached, brief);
      const cachedErrors = cachedUsable ? castErrors(cached) : [];

      if (!cachedUsable || cachedErrors.length > 0) {
        const basePayload = buildCastPlanRequestPayload(brief);
        let best: { plan: CastPlan; errorCount: number; errors: string[] } | null =
          cachedUsable && cachedErrors.length > 0
            ? { plan: cached, errorCount: cachedErrors.length, errors: cachedErrors }
            : null;
        let lastAttemptError: unknown = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            type CastPayload = typeof basePayload & { previousAttempt?: CastPlan; previousIssues?: string[] };
            const payload: CastPayload = !best
              ? basePayload
              : { ...basePayload, previousAttempt: best.plan, previousIssues: best.errors };
            const { data, error: reqError } = await generateCastPlan({ body: payload });
            if (reqError || !data) throw new Error('не удалось запустить генерацию каста');
            const plan = await pollBatchResult(data.batchId, parseCastPlan);
            const errors = castErrors(plan);
            if (!best || errors.length < best.errorCount) {
              best = { plan, errorCount: errors.length, errors };
            }
            if (errors.length === 0) break;
          } catch (attemptErr) {
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          useNarrativeStore.getState().setCastPlan(best.plan);
        } else {
          // Деградация: стаб-агенды держат пайплайн живым, автор видит причину.
          const reason = best
            ? best.errors.slice(0, 2).join('; ')
            : lastAttemptError instanceof Error
            ? lastAttemptError.message
            : String(lastAttemptError ?? 'нет ответа');
          softIssues.push(`[warning] cast: LLM-стадия не дала валидного плана (${reason}) — использован стаб`);
          useNarrativeStore.getState().setCastPlan(buildStubCastPlan(brief));
        }
      }
    }
    const castPlan = useNarrativeStore.getState().castPlan;
    if (!castPlan) {
      fail('cast', 'стадия cast не оставила плана в сторе');
      return;
    }

    // ── Phase 2: world_calendar — мир + календарь + маппинг тегов. ──────────
    publish('world_calendar', 1);
    {
      const store = useNarrativeStore.getState();
      const artifactErrors = (a: WorldCalendarArtifact): string[] =>
        validateCalendar(a.calendar, brief, a.world, a.tagMap, castPlan)
          .filter(i => i.severity === 'error')
          .map(formatIssue);

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
          .map(formatIssue);

      const cachedSpine = useNarrativeStore.getState().spine;
      const cachedSpineErrors = cachedSpine ? spineErrors(cachedSpine) : [];
      // Затравки story QA: кэш считается невалидным, его ошибки + затравки
      // уходят фидбеком первой попытки (previousAttempt сохраняется).
      const spineSeeds = options?.seedIssues?.spine ?? [];
      const cachedSpineFeedback = [...cachedSpineErrors, ...spineSeeds];

      if (!cachedSpine || cachedSpineFeedback.length > 0) {
        try {
          const basePayload = buildSpineRequestPayload(brief, worldModel, calendar, tagMap);
          let best: { plan: SpinePlan; errorCount: number; errors: string[] } | null =
            cachedSpine && cachedSpineFeedback.length > 0
              ? { plan: cachedSpine, errorCount: cachedSpineFeedback.length, errors: cachedSpineFeedback }
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
              const rawPlan = await pollBatchResult(data.batchId, parseSpinePlan);
              // Нормализуем окна битов ДО валидации и сохранения: компилятор,
              // reachability и расписание используют сохранённый хребет.
              const plan = normalizeSpineWindows(rawPlan, calendar);
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

    // ── Phase 4: schedule — детерминированный солвер, без LLM. ──────────────
    // setSchedule сбрасывает eventUnits/unitProse, поэтому валидное против
    // текущих входов расписание не трогаем.
    publish('schedule', 3);
    {
      const scheduleErrors = (s: CharacterSchedule) =>
        validateSchedule(s, spine, calendar, brief)
          .filter(i => i.severity === 'error')
          .map(formatIssue);

      const cachedSchedule = useNarrativeStore.getState().schedule;
      if (!cachedSchedule || scheduleErrors(cachedSchedule).length > 0) {
        const built = buildSchedule(brief, spine, calendar, castPlan, tagMap);
        const errors = scheduleErrors(built);
        if (errors.length > 0) {
          fail('schedule', `расписание не прошло валидацию (${errors.length} ошибок)`, errors);
          return;
        }
        useNarrativeStore.getState().setSchedule(built);
      }
    }
    const schedule = useNarrativeStore.getState().schedule;
    if (!schedule) {
      fail('schedule', 'стадия schedule не оставила расписания в сторе');
      return;
    }

    // ── Phase 5: beat_prose — проза битов хребта (реюз стадии anchorBeat). ──
    // deriveLegacyOutline адаптирует хребет к легаси-контракту anchorBeat;
    // биты идут последовательно в топо-порядке, потому что предшественникам
    // в payload нужны beatText уже принятых битов. Валидный кэшированный бит
    // (против ТЕКУЩЕГО производного outline) не регенерируется; невалидный —
    // сидирует best-of retry как previousAttempt.
    publish('beat_prose', 4);
    {
      const stageIssues: string[] = [];
      const derived = deriveLegacyOutline(spine, calendar, schedule, brief, worldModel);
      // buildAnchorBeatRequest читает worldModel.anchorLocations — подмешиваем
      // производные привязки якорей (тот же трюк, что в ExportBar).
      const worldForBeats: WorldModel = {
        ...worldModel,
        anchorLocations: { ...worldModel.anchorLocations, ...derived.anchorLocations },
      };
      const liNames = brief.loveInterests.flatMap(li => [li.name, li.id]).filter(Boolean);
      // Проза, принятая В ЭТОМ прогоне (кэш + свежая), — контекст предков.
      const acceptedBeats: Record<string, AnchorBeat> = {};

      for (const anchor of topoOrderAnchors(derived.outline)) {
        const outgoingIds = outgoingOf(derived.outline, anchor.id);
        const beatErrors = (b: AnchorBeat): string[] =>
          validateAnchorBeat(b, anchor.id, outgoingIds, liNames)
            .filter(i => i.severity === 'error')
            .map(formatIssue);

        // anchor.id === beat.id по построению адаптера — кэш ищем по нему же.
        const cached = useNarrativeStore.getState().spineBeatProse[anchor.id];
        const cachedErrors = cached ? beatErrors(cached) : [];
        if (cached && cachedErrors.length === 0) {
          acceptedBeats[anchor.id] = cached;
          continue;
        }

        try {
          const basePayload = buildAnchorBeatRequestPayload(
            brief,
            derived.outline,
            anchor,
            acceptedBeats,
            worldForBeats,
          );
          type BeatPayload = typeof basePayload & { previousAttempt?: AnchorBeat; previousIssues?: string[] };
          let best: { beat: AnchorBeat; errorCount: number; errors: string[] } | null = cached
            ? { beat: cached, errorCount: cachedErrors.length, errors: cachedErrors }
            : null;
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              const payload: BeatPayload = !best
                ? basePayload
                : { ...basePayload, previousAttempt: best.beat, previousIssues: best.errors };
              const { data, error: reqError } = await generateAnchorBeat({ body: payload });
              if (reqError || !data) throw new Error(`не удалось запустить генерацию прозы бита ${anchor.id}`);
              const beat = await pollBatchResult(data.batchId, parseAnchorBeat);
              const errors = beatErrors(beat);
              if (!best || errors.length < best.errorCount) {
                best = { beat, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (best && best.errorCount === 0) {
            acceptedBeats[anchor.id] = best.beat;
            useNarrativeStore.getState().setSpineBeatProse(anchor.id, best.beat);
          } else if (best) {
            stageIssues.push(`${anchor.id}: проза бита не прошла валидацию: ${best.errors.slice(0, 2).join('; ')}`);
          } else {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          }
        } catch (e) {
          stageIssues.push(`${anchor.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (stageIssues.length > 0) {
        fail('beat_prose', `проза битов не собрана полностью (${stageIssues.length} проблем)`, stageIssues);
        return;
      }
    }

    // ── Phase 6: event_pool — пул событий-шеллов per LI (B2). ───────────────
    // Валидный кэшированный пул персонажа (против текущих входов) не
    // регенерируется. Итог пишется полной заменой (replaceEventUnits) —
    // юниты пере-генерированных персонажей не должны выживать под старыми id.
    publish('event_pool', 5);
    {
      const stageIssues: string[] = [];
      const finalUnits: EventUnit[] = [];
      const cachedAll = Object.values(useNarrativeStore.getState().eventUnits);

      const poolErrors = (units: EventUnit[]): string[] =>
        validateEventUnits(units, brief, calendar, spine, schedule)
          .filter(i => i.severity === 'error')
          .map(formatIssue);

      for (const li of brief.loveInterests) {
        const cachedPool = cachedAll.filter(u => u.participants[0] === li.id);
        const cachedPoolErrors = cachedPool.length > 0 ? poolErrors(cachedPool) : [];
        if (cachedPool.length > 0 && cachedPoolErrors.length === 0) {
          finalUnits.push(...cachedPool);
          continue;
        }

        try {
          const basePayload = buildEventPoolRequestPayload(brief, li, castPlan, schedule, spine, calendar);
          let best: { units: EventUnit[]; errorCount: number; errors: string[] } | null =
            cachedPool.length > 0
              ? { units: cachedPool, errorCount: cachedPoolErrors.length, errors: cachedPoolErrors }
              : null;
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              type PoolPayload = typeof basePayload & {
                previousAttempt?: ReturnType<typeof eventPoolToAttempt>;
                previousIssues?: string[];
              };
              const payload: PoolPayload = !best
                ? basePayload
                : { ...basePayload, previousAttempt: eventPoolToAttempt(best.units), previousIssues: best.errors };
              const { data, error: reqError } = await generateEventPool({ body: payload });
              if (reqError || !data) throw new Error(`не удалось запустить генерацию пула событий ${li.id}`);
              const units = await pollBatchResult(data.batchId, raw => parseEventPool(raw, li.id));
              const errors = poolErrors(units);
              if (!best || errors.length < best.errorCount) {
                best = { units, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (best && best.errorCount === 0) {
            finalUnits.push(...best.units);
          } else if (best) {
            stageIssues.push(`${li.id}: пул не прошёл валидацию: ${best.errors.slice(0, 3).join('; ')}`);
          } else {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          }
        } catch (e) {
          stageIssues.push(`${li.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (stageIssues.length > 0) {
        fail('event_pool', `пул событий не собран полностью (${stageIssues.length} проблем)`, stageIssues);
        return;
      }
      useNarrativeStore.getState().replaceEventUnits(finalUnits);
    }
    const eventUnits = Object.values(useNarrativeStore.getState().eventUnits);

    // ── Phase 7: prune — reachability-отсев, без LLM (B3). ──────────────────
    // Недостижимым юнитам проза не генерируется; множество живёт в локальной
    // переменной прогона — стор хранит полный пул (монтажка показывает всё).
    publish('prune', 6);
    const reachable = computeReachableUnits(spine, calendar, eventUnits);
    {
      const pruned = eventUnits.length - reachable.size;
      if (pruned > 0) {
        softIssues.push(
          `[warning] prune: ${pruned} из ${eventUnits.length} юнитов недостижимы — проза для них не генерируется`,
        );
      }
    }

    // ── Phase 8: dialogue_units — проза per ДОСТИЖИМЫЙ юнит × 3 брекета. ────
    // Структурный validateDialogueUnit гейтит best-of retry (≤MAX_ATTEMPTS с
    // previousIssues-фидбеком); поверх структурно валидного юнита — ОДИН
    // dialogueQA-проход (LLM-критик: ответы на ask, тон=брекету, завершённость
    // closing); error-severity QA-issues дают одну дополнительную попытку
    // регенерации. Кэш: юнит с 3 брекетами, валидными против текущих входов,
    // пропускается (деньги — только на отсутствующее и невалидное).
    publish('dialogue_units', 7);
    {
      const stageIssues: string[] = [];
      const liById = new Map(brief.loveInterests.map(li => [li.id, li]));
      // Разорванные циклы диалогов — warning один раз на юнит/брекет.
      const cycleWarned = new Set<string>();

      for (const unit of eventUnits) {
        if (!reachable.has(unit.id) || unit.kind !== 'dialogue') continue;
        const li = liById.get(unit.participants[0] ?? '');
        if (!li) continue;

        const unitKey = unit.id;
        const unitErrors = (u: DialogueUnit): string[] =>
          validateDialogueUnit(u, li.id)
            .filter(i => i.severity === 'error')
            .map(formatIssue);

        // Затравки story QA для этого юнита: валидный кэш регенерируется
        // с фидбеком (previousAttempt = кэш, previousIssues = затравки).
        const unitSeeds = options?.seedIssues?.dialogue?.[unitKey] ?? [];

        const cached = useNarrativeStore.getState().unitProse[unitKey] ?? [];
        const cachedComplete =
          unitSeeds.length === 0 &&
          cached.length === 3 &&
          BRACKETS.every(b => {
            const u = cached.find(x => x.bracket === b);
            return u != null && unitErrors(u).length === 0;
          });
        if (cachedComplete) continue;

        const units: DialogueUnit[] = [];
        for (const bracket of BRACKETS) {
          // Валидный кэшированный брекет не трогаем (если нет затравок QA).
          const cachedForBracket = cached.find(u => u.bracket === bracket);
          if (unitSeeds.length === 0 && cachedForBracket && unitErrors(cachedForBracket).length === 0) {
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
              unit,
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
              const raw = await pollBatchResult(data.batchId, parseDialogueUnit);
              // Нормализация: LLM устойчиво пишет циклы «возврат к теме» —
              // рвём детерминированно (см. breakDialogueCycles), автору warning.
              const { unit: normalized, broken } = breakDialogueCycles(raw);
              if (broken.length > 0 && !cycleWarned.has(`${unitKey}/${bracket}`)) {
                cycleWarned.add(`${unitKey}/${bracket}`);
                softIssues.push(
                  `[warning] dialogue: ${unitKey}/${bracket}: разорваны циклы диалога (${broken.join(', ')})`,
                );
              }
              return normalized;
            };

            // Невалидный кэш (или валидный с затравками QA) сидирует best —
            // его ошибки + затравки уходят фидбеком первой попытки.
            let best: { unit: DialogueUnit; errorCount: number; errors: string[] } | null = null;
            if (cachedForBracket != null) {
              const cachedFeedback = [...unitErrors(cachedForBracket), ...unitSeeds];
              best = { unit: cachedForBracket, errorCount: cachedFeedback.length, errors: cachedFeedback };
            }
            let lastAttemptError: unknown = null;
            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
              try {
                const generated = await generateOnce(
                  best && best.errorCount > 0 ? { unit: best.unit, errors: best.errors } : null,
                );
                const errors = unitErrors(generated);
                if (!best || errors.length < best.errorCount) {
                  best = { unit: generated, errorCount: errors.length, errors };
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
              stageIssues.push(`${unitKey}/${bracket}: сохранён с ошибками: ${best.errors.slice(0, 2).join('; ')}`);
            }
          } catch (e) {
            stageIssues.push(`${unitKey}/${bracket}: ${e instanceof Error ? e.message : String(e)}`);
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

    // ── Phase 9: ending_prose — эпилоги концовок хребта (реюз легаси-стадии
    // ending поверх deriveLegacyOutline; тот же трюк, что beat_prose). Без них
    // компилятор не строит ending-router и финал зацикливается в хаб. Ключи —
    // ровно те, что нужны концовкам спайна (endingKey(kind, liId)); валидный
    // кэш пропускается. setSpine каскадно чистит endings — инвалидация есть.
    publish('ending_prose', 8);
    {
      const stageIssues: string[] = [];
      const derived = deriveLegacyOutline(spine, calendar, schedule, brief, worldModel);
      const liById = new Map(brief.loveInterests.map(li => [li.id, li]));
      const spineBeatProse = useNarrativeStore.getState().spineBeatProse;

      const endingErrors = (v: EndingVariant, kind: typeof spine.endings[number]['kind']): string[] =>
        validateEndingVariant(v, kind)
          .filter(i => i.severity === 'error')
          .map(formatIssue);

      // Дедуп по ключу: у спайна может быть несколько концовок одного kind/liId.
      const wanted = new Map<string, { kind: typeof spine.endings[number]['kind']; liId: string | null }>();
      for (const e of spine.endings) {
        const key = endingKey(e.kind, e.liId ?? undefined);
        if (!wanted.has(key)) wanted.set(key, { kind: e.kind, liId: e.liId ?? null });
      }

      for (const [key, task] of wanted) {
        const li = task.liId ? liById.get(task.liId) ?? null : null;
        const cached = useNarrativeStore.getState().endings[key];
        if (cached && endingErrors(cached, task.kind).length === 0) continue;

        try {
          const basePayload = buildEndingRequestPayload(brief, derived.outline, task.kind, li, null, spineBeatProse);
          type EndingPayload = typeof basePayload & { previousAttempt?: EndingVariant; previousIssues?: string[] };
          let best: { ending: EndingVariant; errorCount: number; errors: string[] } | null =
            cached != null
              ? {
                  ending: cached,
                  errorCount: endingErrors(cached, task.kind).length,
                  errors: endingErrors(cached, task.kind),
                }
              : null;
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              const payload: EndingPayload = !best
                ? basePayload
                : { ...basePayload, previousAttempt: best.ending, previousIssues: best.errors };
              const { data, error: reqError } = await generateEnding({ body: payload });
              if (reqError || !data) throw new Error(`не удалось запустить генерацию концовки ${key}`);
              const ending = await pollBatchResult(data.batchId, parseEndingVariant);
              const errors = endingErrors(ending, task.kind);
              if (!best || errors.length < best.errorCount) {
                best = { ending, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (best && best.errorCount === 0) {
            // liId генератора может отсутствовать/врать — фиксируем свой.
            useNarrativeStore.getState().setEnding(key, { ...best.ending, kind: task.kind, liId: task.liId });
          } else if (best) {
            stageIssues.push(`${key}: эпилог не прошёл валидацию: ${best.errors.slice(0, 2).join('; ')}`);
          } else {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          }
        } catch (e) {
          stageIssues.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (stageIssues.length > 0) {
        fail('ending_prose', `эпилоги концовок не собраны полностью (${stageIssues.length} проблем)`, stageIssues);
        return;
      }
    }

    setIssues(softIssues);
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
 * EventUnit[] → LLM-контракт eventPool (для previousAttempt-фидбека):
 * guard/effects разворачиваются в плоские requires/establishes/relEffects —
 * fired-цепочку клиент строит сам и в фидбек её не выносит.
 */
function eventPoolToAttempt(units: EventUnit[]): { units: Record<string, unknown>[] } {
  return {
    units: units.map(u => ({
      id: u.id,
      arcStage: u.arcStage ?? 1,
      goal: u.goal,
      locationId: u.at.locationId ?? '',
      window: u.at.slot ?? { fromSlot: 0, toSlot: 0 },
      requires: guardFlags(u.guard),
      establishes: unitEstablishes(u),
      relEffects: u.effects.flatMap(e => ('rel' in e ? [{ var: e.rel.var, delta: e.rel.delta }] : [])),
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
