import {
  generateAnchorBeat,
  generateAnchorTransition,
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
import {
  arcStageCount,
  computeCalendarTargets,
  daypartOfSlot,
  parseAnchorTransitions,
  normalizeSpineWindows,
  parseCalendar,
  parseCastPlan,
  parseSpinePlan,
} from './calendarTypes';
import type { DialogueUnit } from './dialogueUnit';
import {
  breakDialogueCycles,
  lintFarewellInBody,
  lintTimeOfDay,
  normalizeChoicePathDeltas,
  parseDialogueUnit,
  validateDialogueUnit,
} from './dialogueUnit';
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
import { synthesizeCoverageFillers } from './coverageUnits';
import { applyLadderGuards, skipsNegativeBracket } from './ladderGuards';
import { useNarrativeStore } from './narrativeStore';
import {
  committedAllowed,
  effectiveMap,
  effectiveScalar,
  flattenSoftIssues,
  matchPendingBatch,
  shouldReuseDraft,
  TOTAL_STEPS,
  type BulkCalendarPhase,
  type BulkCalendarRunOptions,
  type CalendarCascadeStage,
  type CalendarDraft,
  type CalendarRunState,
  type CommittedStack,
  type DraftMapField,
  type DraftScalarField,
} from './calendarRunState';

/**
 * Оркестрация календарного пайплайна (фазы 1+3+4 docs/plans/calendar-branching.md):
 * cast (LLM, фолбэк — стаб) → world_calendar (LLM) → spine (LLM) → schedule
 * (детерминированный солвер buildSchedule) → beat_prose (LLM: проза битов
 * хребта через легаси-стадию anchorBeat поверх deriveLegacyOutline) →
 * event_pool (LLM, per LI) → prune (reachability, без LLM) → dialogue_units
 * (LLM: достижимый юнит × 3 брекета, structural validate + dialogueQA-критик) →
 * ending_prose (LLM, per концовку).
 *
 * Механика LLM-стадий: endpoint → polling /status/:batchId, best-of retry ≤3
 * попыток с фидбеком previousAttempt/previousIssues из ошибок валидатора.
 * Валидные кэшированные артефакты (против ТЕКУЩИХ входов) не регенерируются —
 * деньги уходят только на отсутствующее и невалидное.
 *
 * Транзакционность: прогон НИЧЕГО не пишет в committed-поля стора до самого
 * конца — стадии кладут артефакты в calendarRun.draft, и только успешный
 * финал коммитит их одним set() (commitCalendarRun). Обрыв, ошибка стадии или
 * закрытие вкладки оставляют автора со старой историей.
 *
 * Резюмируемость: draft и pendingBatch персистятся, поэтому после reload
 * initNarrative зовёт resumeCalendarRun — стадии переиспользуют уже оплаченные
 * артефакты из draft, а незавершённый батч подхватывается по batchId (если
 * сервер жив; иначе элемент считается заново).
 *
 * Живёт вне React: прогон не привязан к жизненному циклу компонента, UI лишь
 * читает calendarRun из стора (см. useBulkCalendarGeneration).
 *
 * Мультивкладочность: module-guard `running` защищает внутри вкладки, а Web
 * Lock (withCalendarLock) — между вкладками: одновременно прогон ведёт только
 * одна вкладка, остальные лишь показывают его прогресс (кросс-вкладочный синк в
 * initNarrative). Если ведущая вкладка закрылась посреди прогона, замок
 * освобождается, но наблюдатель не подхватывает прогон автоматически — это
 * делает следующий reload любой вкладки (init → resumeCalendarRun).
 *
 * Побочный эффект коммита: авторская правка локации (patchLocation) во время
 * прогона будет перезаписана worldModel-ом из draft.
 */

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;
const MAX_ATTEMPTS = 3;
/** Доп. заходов «хребет ⇄ планировщик»: ошибки validateSchedule → фидбек хребту. */
const MAX_SCHEDULE_ROUNDS = 2;
/** Подряд идущих сетевых сбоев опроса, после которых батч считается недоступным. */
const MAX_POLL_FAILURES = 3;
const BRACKETS: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];

/** Батч не найден на сервере (404): терминально для батча, элемент считается заново. */
export class BatchNotFoundError extends Error {}

/** Артефакт стадии worldCalendar целиком. */
type WorldCalendarArtifact = {
  world: WorldModel;
  calendar: Calendar;
  tagMap: Record<string, string[]>;
};

const formatIssue = (i: SegmentIssue) => `[${i.severity}] ${i.scope}: ${i.message}`;

/** Прогон идёт в этой вкладке — второй старт/резюм игнорируется. */
let running = false;

export const isCalendarRunActive = (): boolean => running;

/** Имя Web Lock: один активный прогон на проект во всех вкладках браузера. */
const CALENDAR_LOCK = 'gu-calendar-run';

/**
 * Прогон под межвкладочным замком. `ifAvailable` — не ждём освобождения: если
 * замок держит другая вкладка, она уже ведёт этот прогон, дублировать незачем
 * (иначе две вкладки платили бы за одни и те же LLM-вызовы). Колбэк получает
 * acquired=false и решает не запускаться. Без Web Locks API (тесты, старые
 * браузеры) деградируем к прежнему поведению — только module-guard `running`.
 */
async function withCalendarLock(cb: (acquired: boolean) => Promise<void>): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    await cb(true);
    return;
  }
  await navigator.locks.request(CALENDAR_LOCK, { ifAvailable: true }, async lock => {
    await cb(lock !== null);
  });
}

/**
 * Общий вход: под замком prepare() решает, есть ли что запускать (и фиксирует
 * старт в сторе), затем крутится пайплайн. Замок держится всю длину прогона.
 */
async function runUnderLock(prepare: () => boolean): Promise<void> {
  if (running) return;
  running = true;
  try {
    await withCalendarLock(async acquired => {
      // Прогон уже ведёт другая вкладка — не трогаем чужой calendarRun,
      // наблюдатель покажет прогресс через кросс-вкладочный синк.
      if (!acquired) return;
      if (!prepare()) return;
      await runPipeline();
    });
  } catch (e) {
    // Непредвиденный сбой: черновик и pendingBatch сохраняются — «Продолжить»
    // подхватит прогон с той же точки.
    const run = store().calendarRun;
    if (run) store().failCalendarRun(run.phase ?? 'cast', e instanceof Error ? e.message : String(e), []);
  } finally {
    running = false;
  }
}

const store = () => useNarrativeStore.getState();

const committedStack = (): CommittedStack => {
  const s = store();
  return {
    castPlan: s.castPlan,
    worldModel: s.worldModel,
    calendar: s.calendar,
    tagMap: s.tagMap,
    anchorNarrations: s.anchorNarrations,
    spine: s.spine,
    schedule: s.schedule,
    eventUnits: s.eventUnits,
    unitProse: s.unitProse,
    spineBeatProse: s.spineBeatProse,
    endings: s.endings,
  };
};

const newRunId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `run-${Date.now()}`;

/**
 * Старт прогона. Черновик прошлого прогона переиспользуется, если он собран под
 * тот же бриф и тот же режим force («Продолжить» после обрыва не платит дважды).
 */
export async function startCalendarRun(brief: Brief, options?: BulkCalendarRunOptions): Promise<void> {
  const force = options?.force ?? false;
  // beginCalendarRun пишется ПОД замком: вкладка, не получившая его, не должна
  // затирать calendarRun чужого активного прогона.
  await runUnderLock(() => {
    const prev = store().calendarRun;
    const resumed: CalendarRunState = shouldReuseDraft(prev, brief, force)
      ? { ...(prev as CalendarRunState), status: 'running', error: null, issues: [], seedIssues: options?.seedIssues }
      : {
          status: 'running',
          force,
          phase: 'cast',
          progress: { completed: 0, total: TOTAL_STEPS },
          error: null,
          issues: [],
          softIssues: {},
          brief,
          seedIssues: options?.seedIssues,
          dirtyStages: [],
          draft: {},
          pendingBatch: null,
          startedAt: Date.now(),
          runId: newRunId(),
        };
    store().beginCalendarRun(resumed);
    return true;
  });
}

/** Продолжение прогона, оборванного перезагрузкой (зовёт initNarrative). */
export async function resumeCalendarRun(): Promise<void> {
  const run = store().calendarRun;
  if (!run || run.status !== 'running') return;
  // Перепроверяем под замком: пока ждали его, другая вкладка могла завершить
  // или отменить прогон.
  await runUnderLock(() => {
    const r = store().calendarRun;
    return !!r && r.status === 'running';
  });
}

// eslint-disable-next-line complexity
async function runPipeline(): Promise<void> {
  const run0 = store().calendarRun;
  if (!run0) return;
  const brief = run0.brief;
  const force = run0.force;
  const seedIssues = run0.seedIssues;

  /** Актуальное состояние прогона (draft/dirtyStages меняются по ходу). */
  const runNow = (): CalendarRunState => {
    const r = store().calendarRun;
    if (!r) throw new Error('прогон снят из стора');
    return r;
  };

  const scalarCache = <K extends DraftScalarField>(field: K) =>
    effectiveScalar(field, runNow().draft, committedStack(), force, runNow().dirtyStages);

  const mapCache = <K extends DraftMapField>(field: K) =>
    effectiveMap(field, runNow().draft, committedStack(), force, runNow().dirtyStages);

  const putDraft = (patch: CalendarDraft) => store().patchCalendarDraft(patch);

  /** Стадия пересчитана заново → committed-кэш нижележащих полей протух. */
  const markRegenerated = (stage: CalendarCascadeStage) => {
    const dirty = runNow().dirtyStages;
    if (!dirty.includes(stage)) store().patchCalendarRun({ dirtyStages: [...dirty, stage] });
  };

  const publish = (phase: BulkCalendarPhase, completed: number) =>
    store().patchCalendarRun({ phase, progress: { completed, total: TOTAL_STEPS } });

  const putSoftIssues = (stage: string, issues: string[]) =>
    store().patchCalendarRun({ softIssues: { ...runNow().softIssues, [stage]: issues } });

  const fail = (phase: BulkCalendarPhase, message: string, stageIssues: string[] = []) => {
    store().failCalendarRun(phase, message, [...flattenSoftIssues(runNow().softIssues), ...stageIssues]);
  };

  /**
   * Единая точка транспорта: переподключение к живому батчу этого же элемента
   * (после reload) либо старт нового с записью batchId в стор до опроса.
   */
  const runBatch = async <T>(
    phase: BulkCalendarPhase,
    itemKey: string | null,
    start: () => Promise<{ batchId: string }>,
    parse: (raw: string) => T,
  ): Promise<T> => {
    const pending = runNow().pendingBatch;
    if (pending && matchPendingBatch(pending, phase, itemKey)) {
      try {
        const result = await pollBatchResult(pending.batchId, parse);
        store().patchCalendarRun({ pendingBatch: null });
        return result;
      } catch (e) {
        store().patchCalendarRun({ pendingBatch: null });
        // Батч потерян (сервер перезапущен) — считаем элемент заново.
        if (!(e instanceof BatchNotFoundError)) throw e;
      }
    }
    const { batchId } = await start();
    store().patchCalendarRun({ phase, pendingBatch: { phase, itemKey, batchId } });
    try {
      return await pollBatchResult(batchId, parse);
    } finally {
      store().patchCalendarRun({ pendingBatch: null });
    }
  };

  // ── Phase 1: cast — LLM-агенды; фолбэк — детерминированный стаб. ──────────
  publish('cast', 0);
  {
    // Высота лестницы близости — из тех же целевых размеров, что дадут
    // календарь: castPlan идёт до стадии календаря, своего у него ещё нет.
    // Кэшированный трёхступенчатый план не пройдёт валидацию против нового N —
    // и существующая петля retry-с-фидбеком его перегенерирует.
    const stageCount = arcStageCount(computeCalendarTargets(brief.scale.targetDurationMinutes).days);
    const castErrors = (p: CastPlan): string[] =>
      validateCastPlan(p, brief, stageCount)
        .filter(i => i.severity === 'error')
        .map(formatIssue);
    /**
     * В фидбек ретрая уходят и ЗАМЕЧАНИЯ — иначе модель о них не узнаёт.
     *
     * Живой прогон это и показал: про число целей (error) модель со второй
     * попытки исправилась, а «своё представление об идеале/худшем» (warning)
     * не отдавала вовсе — фидбек её просто не касался. Блокировать приёмку
     * этими полями нельзя: три провала подряд роняют стадию в стаб, а у стаба
     * целей нет ВООБЩЕ — лестница исчезла бы целиком. Поэтому просим, но не
     * ультиматумом.
     */
    const castFeedback = (p: CastPlan): string[] => validateCastPlan(p, brief, stageCount).map(formatIssue);

    const { value: cached } = scalarCache('castPlan');
    const cachedUsable = cached != null && sameCastMembers(cached, brief);
    const cachedErrors = cachedUsable ? castErrors(cached) : [];

    if (cachedUsable && cachedErrors.length === 0) {
      putDraft({ castPlan: cached });
    } else {
      const basePayload = buildCastPlanRequestPayload(brief);
      let best: { plan: CastPlan; errorCount: number; errors: string[]; feedback: string[] } | null =
        cachedUsable && cachedErrors.length > 0
          ? { plan: cached, errorCount: cachedErrors.length, errors: cachedErrors, feedback: castFeedback(cached) }
          : null;
      let lastAttemptError: unknown = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          type CastPayload = typeof basePayload & { previousAttempt?: CastPlan; previousIssues?: string[] };
          const payload: CastPayload = !best
            ? basePayload
            : { ...basePayload, previousAttempt: best.plan, previousIssues: best.feedback };
          const plan = await runBatch(
            'cast',
            null,
            async () => {
              const { data, error: reqError } = await generateCastPlan({ body: payload });
              if (reqError || !data) throw new Error('не удалось запустить генерацию каста');
              return data;
            },
            parseCastPlan,
          );
          const errors = castErrors(plan);
          const feedback = castFeedback(plan);
          // Лучше = меньше ошибок, при равенстве — меньше замечаний. Сравнение
          // только по ошибкам теряло бы улучшение «0 ошибок + 0 замечаний»
          // поверх «0 ошибок + 2 замечания»: 0 < 0 ложно.
          const better =
            !best ||
            errors.length < best.errorCount ||
            (errors.length === best.errorCount && feedback.length < best.feedback.length);
          if (better) best = { plan, errorCount: errors.length, errors, feedback };
          // Ошибок нет, но замечания есть (не описан идеал/худшее) — тратим
          // оставшиеся попытки на «дожать»: план уже приёмлем, и лучший из
          // виденных всё равно останется у нас.
          if (errors.length === 0 && feedback.length === 0) break;
        } catch (attemptErr) {
          lastAttemptError = attemptErr;
        }
      }
      if (best && best.errorCount === 0) {
        putDraft({ castPlan: best.plan });
      } else {
        // Деградация: стаб-агенды держат пайплайн живым, автор видит причину.
        const reason = best
          ? best.errors.slice(0, 2).join('; ')
          : lastAttemptError instanceof Error
          ? lastAttemptError.message
          : String(lastAttemptError ?? 'нет ответа');
        putSoftIssues('cast', [`[warning] cast: LLM-стадия не дала валидного плана (${reason}) — использован стаб`]);
        putDraft({ castPlan: buildStubCastPlan(brief) });
      }
      markRegenerated('cast');
    }
  }
  const castPlan = runNow().draft.castPlan;
  if (!castPlan) {
    fail('cast', 'стадия cast не оставила плана');
    return;
  }

  // ── Phase 2: world_calendar — мир + календарь + маппинг тегов. ────────────
  publish('world_calendar', 1);
  {
    const artifactErrors = (a: WorldCalendarArtifact): string[] =>
      validateCalendar(a.calendar, brief, a.world, a.tagMap, castPlan)
        .filter(i => i.severity === 'error')
        .map(formatIssue);

    const cachedWorld = scalarCache('worldModel').value;
    const cachedCalendar = scalarCache('calendar').value;
    const cachedTagMap = scalarCache('tagMap').value;
    const cached: WorldCalendarArtifact | null =
      cachedWorld && cachedCalendar && cachedTagMap
        ? { world: cachedWorld, calendar: cachedCalendar, tagMap: cachedTagMap }
        : null;
    const cachedErrors = cached ? artifactErrors(cached) : [];

    if (cached && cachedErrors.length === 0) {
      putDraft({ worldModel: cached.world, calendar: cached.calendar, tagMap: cached.tagMap });
    } else {
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
            const artifact = await runBatch(
              'world_calendar',
              null,
              async () => {
                const { data, error: reqError } = await generateWorldCalendar({ body: payload });
                if (reqError || !data) throw new Error('не удалось запустить построение мира и календаря');
                return data;
              },
              parseWorldCalendarResult,
            );
            const errors = artifactErrors(artifact);
            if (!best || errors.length < best.errorCount) best = { artifact, errorCount: errors.length, errors };
            if (errors.length === 0) break;
          } catch (attemptErr) {
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          putDraft({ worldModel: best.artifact.world, calendar: best.artifact.calendar, tagMap: best.artifact.tagMap });
          markRegenerated('world_calendar');
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
  const { worldModel, calendar, tagMap } = runNow().draft;
  if (!worldModel || !calendar) {
    fail('world_calendar', 'стадия worldCalendar не оставила артефактов');
    return;
  }

  // ── Phase 3+4: spine ⇄ schedule — петля с фидбеком планировщика. ──────────
  // Планировщик детерминирован: хребет, чьи биты несовместимы с weekly-
  // паттернами участников, валит schedule ВСЕГДА — без петли это тупик
  // (повторный запуск берёт тот же хребет из кэша и падает так же). Ошибки
  // validateSchedule уходят previousIssues-фидбеком регенерации хребта,
  // ≤MAX_SCHEDULE_ROUNDS дополнительных заходов.
  const spineErrors = (s: SpinePlan): string[] =>
    validateSpine(s, calendar, brief, worldModel)
      .filter(i => i.severity === 'error')
      .map(formatIssue);
  const scheduleErrorsFor = (s: CharacterSchedule, sp: SpinePlan): string[] =>
    validateSchedule(s, sp, calendar, brief)
      .filter(i => i.severity === 'error')
      .map(formatIssue);

  /** Стадия spine; scheduleFeedback делает кэш (включая draft) невалидным. */
  const runSpineStage = async (scheduleFeedback: string[]): Promise<SpinePlan | null> => {
    const { value: cachedSpine, source } = scalarCache('spine');
    const cachedSpineErrors = cachedSpine ? spineErrors(cachedSpine) : [];
    // Затравки story QA бьют только по committed-кэшу: хребет, посчитанный в
    // этом же прогоне (draft), их уже учёл — при resume не переплачиваем.
    // Фидбек планировщика, наоборот, бьёт и по draft — он про ЭТОТ хребет.
    const spineSeeds = source === 'committed' ? seedIssues?.spine ?? [] : [];
    const cachedSpineFeedback = [...cachedSpineErrors, ...spineSeeds, ...scheduleFeedback];

    if (cachedSpine && cachedSpineFeedback.length === 0) {
      putDraft({ spine: cachedSpine });
      return cachedSpine;
    }
    try {
      const basePayload = buildSpineRequestPayload(brief, worldModel, calendar, tagMap ?? null);
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
          const rawPlan = await runBatch(
            'spine',
            null,
            async () => {
              const { data, error: reqError } = await generateSpine({ body: payload });
              if (reqError || !data) throw new Error('не удалось запустить генерацию хребта');
              return data;
            },
            parseSpinePlan,
          );
          // Нормализуем окна битов ДО валидации и сохранения: компилятор,
          // reachability и расписание используют сохранённый хребет.
          const plan = normalizeSpineWindows(rawPlan, calendar);
          const errors = spineErrors(plan);
          if (!best || errors.length < best.errorCount) best = { plan, errorCount: errors.length, errors };
          if (errors.length === 0) break;
        } catch (attemptErr) {
          lastAttemptError = attemptErr;
        }
      }
      if (best && best.errorCount === 0) {
        putDraft({ spine: best.plan });
        markRegenerated('spine');
        return best.plan;
      }
      if (!best && lastAttemptError) {
        throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
      }
      fail('spine', `хребет не прошёл валидацию (${best?.errorCount ?? '?'} ошибок)`, best?.errors ?? []);
      return null;
    } catch (e) {
      fail('spine', e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  let spineLoop: SpinePlan | null = null;
  let scheduleLoop: CharacterSchedule | null = null;
  let scheduleFeedback: string[] = [];
  for (let round = 0; round <= MAX_SCHEDULE_ROUNDS; round++) {
    publish('spine', 2);
    spineLoop = await runSpineStage(scheduleFeedback);
    if (!spineLoop) return; // fail уже записан стадией

    publish('schedule', 3);
    const { value: cachedSchedule } = scalarCache('schedule');
    if (cachedSchedule && scheduleErrorsFor(cachedSchedule, spineLoop).length === 0) {
      putDraft({ schedule: cachedSchedule });
      scheduleLoop = cachedSchedule;
      break;
    }
    const built = buildSchedule(brief, spineLoop, calendar, castPlan, tagMap ?? null);
    const errors = scheduleErrorsFor(built, spineLoop);
    if (errors.length === 0) {
      putDraft({ schedule: built });
      markRegenerated('schedule');
      scheduleLoop = built;
      break;
    }
    if (round === MAX_SCHEDULE_ROUNDS) {
      fail(
        'schedule',
        `расписание не прошло валидацию (${errors.length} ошибок) — хребет несовместим с ` +
          `weekly-паттернами каста даже после ${MAX_SCHEDULE_ROUNDS} регенераций с фидбеком`,
        errors,
      );
      return;
    }
    scheduleFeedback = errors.map(e => `${e} — исправь локацию/окно бита под расписание участника`);
  }
  if (!spineLoop || !scheduleLoop) {
    fail('schedule', 'стадия schedule не оставила расписания');
    return;
  }
  // Дальше по пайплайну — только неизменяемые ссылки (замыкания стадий).
  const spine = spineLoop;
  const schedule = scheduleLoop;

  // ── Phase 5: beat_prose — проза битов хребта (реюз стадии anchorBeat). ────
  // deriveLegacyOutline адаптирует хребет к легаси-контракту anchorBeat; биты
  // идут последовательно в топо-порядке, потому что предшественникам в payload
  // нужны beatText уже принятых битов.
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
      const cached = mapCache('spineBeatProse').value[anchor.id];
      const cachedErrors = cached ? beatErrors(cached) : [];
      if (cached && cachedErrors.length === 0) {
        acceptedBeats[anchor.id] = cached;
        putDraft({ spineBeatProse: { [anchor.id]: cached } });
        continue;
      }

      try {
        const basePayload = buildAnchorBeatRequestPayload(brief, derived.outline, anchor, acceptedBeats, worldForBeats);
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
            const beat = await runBatch(
              'beat_prose',
              anchor.id,
              async () => {
                const { data, error: reqError } = await generateAnchorBeat({ body: payload });
                if (reqError || !data) throw new Error(`не удалось запустить генерацию прозы бита ${anchor.id}`);
                return data;
              },
              parseAnchorBeat,
            );
            const errors = beatErrors(beat);
            if (!best || errors.length < best.errorCount) best = { beat, errorCount: errors.length, errors };
            if (errors.length === 0) break;
          } catch (attemptErr) {
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          acceptedBeats[anchor.id] = best.beat;
          putDraft({ spineBeatProse: { [anchor.id]: best.beat } });
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

  // ── Phase 5b: якорные переходы — диегетическая смена части дня. ───────────
  // Один вызов на историю (tier C) — «пойти на занятия», «лечь спать». Это
  // единственный, кроме сюжета, способ двинуть большую стрелку: холостого
  // «Подождать» в игре нет. Стадия НЕ блокирующая: у компилятора есть статичные
  // фолбэки, и падать из-за необязательного колорита — несоразмерно.
  {
    const cachedAnchors = scalarCache('anchorNarrations').value;
    if (cachedAnchors && Object.keys(cachedAnchors).length > 0) {
      putDraft({ anchorNarrations: cachedAnchors });
    } else {
      try {
        const dayparts = calendar.dayparts;
        const homeLocId = (runNow().draft.tagMap ?? committedStack().tagMap)?.home?.[0] ?? '';
        const homeName = worldModel.locations.find(l => l.id === homeLocId)?.name ?? '';
        const narrations = await runBatch(
          'anchor_transitions',
          null,
          async () => {
            const { data, error: reqError } = await generateAnchorTransition({
              body: { brief, dayparts, homeLocationName: homeName },
            });
            if (reqError || !data) throw new Error('не удалось запустить генерацию якорных переходов');
            return data;
          },
          raw => parseAnchorTransitions(raw, dayparts.length),
        );
        putDraft({ anchorNarrations: narrations });
      } catch (e) {
        putSoftIssues('anchor_transitions', [
          `[warning] переходы частей дня не сгенерированы (${
            e instanceof Error ? e.message : String(e)
          }) — игра возьмёт статичные подписи`,
        ]);
      }
    }
  }

  // ── Phase 6: event_pool — пул событий-шеллов per LI (B2). ─────────────────
  // Пул персонажа берётся из черновика (если посчитан в этом прогоне) либо из
  // committed-кэша; юниты пере-генерированных персонажей не выживают под
  // старыми id — коммит заменяет пул целиком тем, что собрано здесь.
  publish('event_pool', 5);
  {
    const stageIssues: string[] = [];
    const finalUnits: EventUnit[] = [];

    const poolErrors = (units: EventUnit[]): string[] =>
      validateEventUnits(units, brief, calendar, spine, schedule)
        .filter(i => i.severity === 'error')
        .map(formatIssue);
    /**
     * Замечания — тоже в фидбек ретрая (как у каста). Живой прогон показал: у
     * двух LI из трёх пул обрывался на 3-й ступени пятиступенчатой лестницы —
     * «дыра в лестнице» это warning, а в фидбек уходили только ошибки, и модель
     * о пропуске не узнавала. Приёмку замечания не блокируют: пул без ступени
     * лучше, чем стадия, упавшая в ноль.
     */
    const poolFeedback = (units: EventUnit[]): string[] =>
      validateEventUnits(units, brief, calendar, spine, schedule).map(formatIssue);

    const committedPoolAllowed = committedAllowed('eventUnits', force, runNow().dirtyStages);

    for (const li of brief.loveInterests) {
      // Пул этого LI: сначала черновик прогона, иначе committed-кэш. Смешивать
      // нельзя — иначе к свежему пулу приклеятся юниты прошлого прогона.
      const draftPool = Object.values(runNow().draft.eventUnits ?? {}).filter(u => u.participants[0] === li.id);
      const cachedPool =
        draftPool.length > 0
          ? draftPool
          : committedPoolAllowed
          ? Object.values(committedStack().eventUnits).filter(u => u.participants[0] === li.id)
          : [];
      // Затравки QA (sim-мёртвые слоты, deadContent) бьют только по committed-
      // пулу: черновик этого прогона уже сгенерирован с их учётом (Д3).
      const liSeeds = draftPool.length > 0 ? [] : seedIssues?.eventPool?.[li.id] ?? [];
      const cachedPoolErrors = cachedPool.length > 0 ? poolFeedback(cachedPool) : [];
      const cachedPoolFeedback = [...cachedPoolErrors, ...liSeeds];
      if (cachedPool.length > 0 && cachedPoolFeedback.length === 0) {
        finalUnits.push(...cachedPool);
        putDraft({ eventUnits: Object.fromEntries(cachedPool.map(u => [u.id, u])) });
        continue;
      }

      try {
        const basePayload = buildEventPoolRequestPayload(brief, li, castPlan, schedule, spine, calendar);
        let best: { units: EventUnit[]; errorCount: number; errors: string[] } | null =
          cachedPool.length > 0
            ? { units: cachedPool, errorCount: cachedPoolFeedback.length, errors: cachedPoolFeedback }
            : null;
        let lastAttemptError: unknown = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            type PoolPayload = typeof basePayload & {
              previousAttempt?: ReturnType<typeof eventPoolToAttempt>;
              previousIssues?: string[];
            };
            // Затравки без кэша (пул инвалидирован каскадом от нового хребта):
            // предыдущей попытки нет, но QA-замечания обязаны попасть в промпт.
            // Затравки дописываются в фидбек КАЖДОЙ попытки (best.errors у свежей
            // генерации — только структурные ошибки, QA-замечания сами не выживут).
            const payload: PoolPayload = best
              ? {
                  ...basePayload,
                  previousAttempt: eventPoolToAttempt(best.units),
                  previousIssues: [...new Set([...best.errors, ...liSeeds])],
                }
              : liSeeds.length > 0
              ? { ...basePayload, previousIssues: liSeeds }
              : basePayload;
            const units = await runBatch(
              'event_pool',
              li.id,
              async () => {
                const { data, error: reqError } = await generateEventPool({ body: payload });
                if (reqError || !data) throw new Error(`не удалось запустить генерацию пула событий ${li.id}`);
                return data;
              },
              raw => parseEventPool(raw, li.id, arcStageCount(calendar.days)),
            );
            const errors = poolErrors(units);
            // Приёмку решают ОШИБКИ, а фидбек несёт и замечания: пул с дырой в
            // лестнице приемлем (лучше, чем упавшая стадия), но модель обязана
            // о дыре узнать и попробовать закрыть её оставшимися попытками.
            const feedback = [...new Set([...poolFeedback(units), ...liSeeds])];
            const better =
              !best ||
              errors.length < best.errorCount ||
              (errors.length === best.errorCount && feedback.length < best.errors.length);
            if (better) best = { units, errorCount: errors.length, errors: feedback };
            if (errors.length === 0 && feedback.length === 0) break;
          } catch (attemptErr) {
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          finalUnits.push(...best.units);
          putDraft({ eventUnits: Object.fromEntries(best.units.map(u => [u.id, u])) });
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
  }
  // ── Достройка немых диапазонов расписания (без LLM). ──────────────────────
  // Расписание ставит LI в локацию, но кнопка «Поговорить» рождается только из
  // юнита с прозой, а useUnitEncounters глушит фолбэк по расписанию, стоит
  // появиться юниту у ЛЮБОГО персонажа. Диапазон, куда пул не дотянулся,
  // оставался немым — игрок сидел в кафе с Юки и не мог заговорить. Филлеры
  // синтезируются ДО prune/прозы/компиляции: иначе им не достанется прозы (а
  // значит и кнопки), и гейту головы линии не на что будет сослаться.
  {
    const existing = Object.values(runNow().draft.eventUnits ?? {});
    const fillers = synthesizeCoverageFillers(spine, calendar, schedule, existing, brief);
    if (fillers.length > 0) {
      putDraft({ eventUnits: Object.fromEntries(fillers.map(u => [u.id, u])) });
      putSoftIssues(
        'coverage',
        fillers.map(f => `[warning] coverage: добавлена встреча "${f.id}" — пул не покрывал диапазон расписания`),
      );
    }
  }
  const eventUnits = Object.values(runNow().draft.eventUnits ?? {});

  // ── Phase 7: prune — reachability-отсев, без LLM (B3). ────────────────────
  // Недостижимым юнитам проза не генерируется; множество живёт в локальной
  // переменной прогона — стор хранит полный пул (монтажка показывает всё).
  publish('prune', 6);
  // Достижимость считаем по ПОЧИНЕННОМУ графу — тому же, что увидит компилятор.
  // Живой прогон поймал расхождение: прун судил по сырым окнам и хоронил юниты,
  // которым applyLadderGuards поднимает пол и растягивает toSlot. Прозу им не
  // генерировали, а компилятор их оставлял — юнит без прозы он молча пропускает,
  // и ступень арки исчезала. Канон один на всех читателей (см. план, Л3).
  const ladderForPrune = applyLadderGuards(eventUnits, spine, calendar, brief);
  const reachable = computeReachableUnits(ladderForPrune.spine, calendar, ladderForPrune.units);
  {
    const pruned = eventUnits.length - reachable.size;
    putSoftIssues(
      'prune',
      pruned > 0
        ? [`[warning] prune: ${pruned} из ${eventUnits.length} юнитов недостижимы — проза для них не генерируется`]
        : [],
    );
  }

  // ── Phase 8: dialogue_units — проза per ДОСТИЖИМЫЙ юнит × 3 брекета. ──────
  // Структурный validateDialogueUnit гейтит best-of retry (≤MAX_ATTEMPTS с
  // previousIssues-фидбеком); поверх структурно валидного юнита — ОДИН
  // dialogueQA-проход (LLM-критик), error-severity issues которого дают одну
  // дополнительную попытку регенерации.
  publish('dialogue_units', 7);
  {
    const stageIssues: string[] = [];
    const dialogueSoft: string[] = [];
    const liById = new Map(brief.loveInterests.map(li => [li.id, li]));
    // Разорванные циклы диалогов — warning один раз на юнит/брекет.
    const cycleWarned = new Set<string>();
    const scaleWarned = new Set<string>();

    for (const unit of eventUnits) {
      if (!reachable.has(unit.id) || unit.kind !== 'dialogue') continue;
      const li = liById.get(unit.participants[0] ?? '');
      if (!li) continue;

      const unitKey = unit.id;
      const unitErrors = (u: DialogueUnit): string[] =>
        validateDialogueUnit(u, li.id)
          .filter(i => i.severity === 'error')
          .map(formatIssue);

      const prose = mapCache('unitProse');
      const cached = prose.value[unitKey] ?? [];
      // Затравки story QA бьют только по committed-прозе: то, что посчитано в
      // этом прогоне, их уже учло.
      const unitSeeds = prose.draftKeys.has(unitKey) ? [] : seedIssues?.dialogue?.[unitKey] ?? [];

      // Ретраи с затравками гоняются по ПОЛНОМУ валидатору: QA-затравки — это
      // его warnings, и пока warning жив, попытка не считается удачной. Без
      // затравок счёт прежний (только errors) — warnings не жгут деньги.
      // Приёмка юнита при этом всегда по errors: не удалось закрыть warning за
      // MAX_ATTEMPTS — юнит принимается как есть, автору честный softIssue.
      // Линты прозы (время суток, прощание в теле) кормят ТОЛЬКО фидбек новых
      // генераций. В unitErrors им нельзя: там они инвалидировали бы кэш и
      // погнали перегенерацию уже оплаченной прозы. Валидный кэш до этой ветки
      // и не доходит — он короткозамыкается выше по unitErrors.
      //
      // Дайпарты берём из ПОЧИНЕННОГО окна (ladderForPrune), а не сырого:
      // applyLadderGuards поднимает пол ступени, и юнит ступени 3 с сырым окном
      // [2,2]=вечер играется в игре как [6,8]=утро/день/вечер. Судить линт по
      // сырому окну — значит пропустить «Добрый вечер», который в игре враньё
      // 2/3 времени. Ровно та ложь, ради которой линт и создан.
      const playedSlot = ladderForPrune.units.find(u => u.id === unit.id)?.at.slot ?? unit.at.slot;
      const windowDayparts = playedSlot
        ? [
            ...new Set(
              Array.from({ length: playedSlot.toSlot - playedSlot.fromSlot + 1 }, (_, k) =>
                daypartOfSlot(playedSlot.fromSlot + k, calendar),
              ),
            ),
          ]
        : [];
      const proseLints = (u: DialogueUnit): string[] =>
        [...lintTimeOfDay(u, windowDayparts), ...lintFarewellInBody(u)].map(formatIssue);

      const retryIssues = (u: DialogueUnit): string[] => [
        ...(unitSeeds.length > 0 ? validateDialogueUnit(u, li.id).map(formatIssue) : unitErrors(u)),
        ...proseLints(u),
      ];

      const cachedComplete =
        unitSeeds.length === 0 &&
        cached.length === 3 &&
        BRACKETS.every(b => {
          const u = cached.find(x => x.bracket === b);
          return u != null && unitErrors(u).length === 0;
        });
      if (cachedComplete) {
        putDraft({ unitProse: { [unitKey]: cached } });
        continue;
      }

      const units: DialogueUnit[] = [];
      for (const bracket of BRACKETS) {
        // Холодная проза для ступени, вход на которую требует тепла выше
        // холодного порога, — деньги на ветер: такую ветку игрок не увидит
        // никогда. Предикат общий с story QA, иначе QA потребует прозу, которую
        // мы намеренно не генерим, и погонит бесконечную перегенерацию.
        if (bracket === 'negative' && skipsNegativeBracket(unit, brief, calendar, eventUnits)) continue;

        // Валидный кэшированный брекет не трогаем (если нет затравок QA).
        // Нормировку дельт применяем и к кэшу: юниты, записанные до появления
        // капа (или до его правки), несут хорошую прозу и ломаются только
        // арифметикой — чинится на месте, без повторной генерации.
        const cachedRaw = cached.find(u => u.bracket === bracket);
        const cachedForBracket = cachedRaw ? normalizeChoicePathDeltas(cachedRaw).unit : undefined;
        if (unitSeeds.length === 0 && cachedForBracket && unitErrors(cachedForBracket).length === 0) {
          units.push(cachedForBracket);
          // Частичный массив в черновике: resume подхватит уже принятые брекеты.
          putDraft({ unitProse: { [unitKey]: [...units] } });
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
            // Встречи этого LI — чтобы модель знала номер встречи в арке:
            // первая обязана читаться как знакомство даже в positive-брекете.
            eventUnits.filter(u => u.kind === 'dialogue' && u.participants[0] === li.id),
            // Агенда — за персональным смыслом ступени: у замкнутого и дерзкого
            // «открыться» выглядит по-разному.
            runNow().draft.castPlan?.members.find(m => m.id === li.id)?.agenda ??
              castPlan?.members.find(m => m.id === li.id)?.agenda,
          );
          type UnitPayload = typeof basePayload & { previousAttempt?: DialogueUnit; previousIssues?: string[] };
          const generateOnce = async (
            prev: { unit: DialogueUnit; errors: string[] } | null,
            itemKey: string,
          ): Promise<DialogueUnit> => {
            const payload: UnitPayload = !prev
              ? basePayload
              : { ...basePayload, previousAttempt: prev.unit, previousIssues: prev.errors };
            const raw = await runBatch(
              'dialogue_units',
              itemKey,
              async () => {
                const { data, error: reqError } = await generateDialogueUnit({ body: payload });
                if (reqError || !data) throw new Error(`не удалось запустить генерацию юнита bracket=${bracket}`);
                return data;
              },
              parseDialogueUnit,
            );
            // Нормализация: LLM устойчиво пишет циклы «возврат к теме» —
            // рвём детерминированно (см. breakDialogueCycles), автору warning.
            const { unit: acyclic, broken } = breakDialogueCycles(raw);
            if (broken.length > 0 && !cycleWarned.has(`${unitKey}/${bracket}`)) {
              cycleWarned.add(`${unitKey}/${bracket}`);
              dialogueSoft.push(
                `[warning] dialogue: ${unitKey}/${bracket}: разорваны циклы диалога (${broken.join(', ')})`,
              );
              putSoftIssues('dialogue_units', dialogueSoft);
            }
            // Та же логика, что с циклами: сумма дельт по пути — свойство арки,
            // а не текста, и правится арифметикой. Ужимаем пропорционально
            // (см. normalizeChoicePathDeltas), а не заворачиваем юнит.
            const { unit: normalized, scaled } = normalizeChoicePathDeltas(acyclic);
            if (scaled.length > 0 && !scaleWarned.has(`${unitKey}/${bracket}`)) {
              scaleWarned.add(`${unitKey}/${bracket}`);
              dialogueSoft.push(
                `[warning] dialogue: ${unitKey}/${bracket}: дельты ужаты под шаг ступени (${scaled.join(', ')})`,
              );
              putSoftIssues('dialogue_units', dialogueSoft);
            }
            return normalized;
          };

          // Невалидный кэш (или валидный с затравками QA) сидирует best —
          // его проблемы + затравки уходят фидбеком первой попытки.
          let best: { unit: DialogueUnit; retryCount: number; feedback: string[] } | null = null;
          if (cachedForBracket != null) {
            const cachedFeedback = [...new Set([...retryIssues(cachedForBracket), ...unitSeeds])];
            best = { unit: cachedForBracket, retryCount: cachedFeedback.length, feedback: cachedFeedback };
          }
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              const generated = await generateOnce(
                best && best.retryCount > 0 ? { unit: best.unit, errors: best.feedback } : null,
                `${unitKey}/${bracket}`,
              );
              const issues = retryIssues(generated);
              if (!best || issues.length < best.retryCount)
                best = { unit: generated, retryCount: issues.length, feedback: issues };
              if (issues.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (!best) {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          }
          const hardErrors = unitErrors(best.unit);

          // Один QA-проход поверх структурно валидного юнита. Недоступность
          // критика не блокирует пайплайн — QA best-effort по дизайну D1.
          if (hardErrors.length === 0) {
            try {
              const qaErrors = (await runDialogueQA(best.unit, bracket, li, `${unitKey}/${bracket}/qa`, runBatch))
                .filter(i => i.severity === 'error')
                .map(i => `[QA] ${i.scope}: ${i.message}`);
              if (qaErrors.length > 0) {
                // Одна дополнительная регенерация с QA-фидбеком; берём новый
                // юнит только если он структурно чист.
                try {
                  const regen = await generateOnce(
                    { unit: best.unit, errors: qaErrors },
                    `${unitKey}/${bracket}/qa-regen`,
                  );
                  if (unitErrors(regen).length === 0) best = { unit: regen, retryCount: 0, feedback: [] };
                } catch {
                  // Оставляем исходный структурно валидный юнит.
                }
              }
            } catch {
              // QA-критик недоступен — юнит уже структурно валиден.
            }
          }

          units.push(best.unit);
          putDraft({ unitProse: { [unitKey]: [...units] } });
          if (hardErrors.length > 0) {
            stageIssues.push(`${unitKey}/${bracket}: сохранён с ошибками: ${hardErrors.slice(0, 2).join('; ')}`);
          } else if (unitSeeds.length > 0 && best.retryCount > 0) {
            // Warning-затравка не закрылась за MAX_ATTEMPTS — юнит принят,
            // автору честное предупреждение вместо тихого «исправлено».
            dialogueSoft.push(
              `[warning] dialogue: ${unitKey}/${bracket}: затравка QA не закрыта (${best.feedback
                .slice(0, 1)
                .join('; ')})`,
            );
            putSoftIssues('dialogue_units', dialogueSoft);
          }
        } catch (e) {
          stageIssues.push(`${unitKey}/${bracket}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    if (stageIssues.length > 0) {
      fail('dialogue_units', `диалоговые юниты не собраны полностью (${stageIssues.length} проблем)`, stageIssues);
      return;
    }
  }

  // ── Phase 9: ending_prose — эпилоги концовок хребта (реюз легаси-стадии
  // ending поверх deriveLegacyOutline; тот же трюк, что beat_prose). Без них
  // компилятор не строит ending-router и финал зацикливается в хаб.
  publish('ending_prose', 8);
  {
    const stageIssues: string[] = [];
    const derived = deriveLegacyOutline(spine, calendar, schedule, brief, worldModel);
    const liById = new Map(brief.loveInterests.map(li => [li.id, li]));
    const spineBeatProse = runNow().draft.spineBeatProse ?? {};

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
      const cached = mapCache('endings').value[key];
      if (cached && endingErrors(cached, task.kind).length === 0) {
        putDraft({ endings: { [key]: cached } });
        continue;
      }

      try {
        const basePayload = buildEndingRequestPayload(brief, derived.outline, task.kind, li, null, spineBeatProse);
        type EndingPayload = typeof basePayload & { previousAttempt?: EndingVariant; previousIssues?: string[] };
        let best: { ending: EndingVariant; errorCount: number; errors: string[] } | null = cached
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
            const ending = await runBatch(
              'ending_prose',
              key,
              async () => {
                const { data, error: reqError } = await generateEnding({ body: payload });
                if (reqError || !data) throw new Error(`не удалось запустить генерацию концовки ${key}`);
                return data;
              },
              parseEndingVariant,
            );
            const errors = endingErrors(ending, task.kind);
            if (!best || errors.length < best.errorCount) best = { ending, errorCount: errors.length, errors };
            if (errors.length === 0) break;
          } catch (attemptErr) {
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          // liId генератора может отсутствовать/врать — фиксируем свой.
          putDraft({ endings: { [key]: { ...best.ending, kind: task.kind, liId: task.liId } } });
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

  // Единственная запись в committed-стек за весь прогон.
  store().commitCalendarRun();
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

type RunBatchFn = <T>(
  phase: BulkCalendarPhase,
  itemKey: string | null,
  start: () => Promise<{ batchId: string }>,
  parse: (raw: string) => T,
) => Promise<T>;

/**
 * QA-request builder инлайном: юнит + брекет + выжимка карточки LI → issues
 * LLM-критика (D1). Ответ — строгий JSON {"issues": [...]}.
 */
async function runDialogueQA(
  unit: DialogueUnit,
  bracket: DialogueVariantBracket,
  li: LoveInterestCard,
  itemKey: string,
  runBatch: RunBatchFn,
): Promise<SegmentIssue[]> {
  return runBatch(
    'dialogue_units',
    itemKey,
    async () => {
      const { data, error } = await generateDialogueQa({
        body: { unit, bracket, liCardSummary: buildLiCardSummary(li) },
      });
      if (error || !data) throw new Error('не удалось запустить dialogueQA');
      return data;
    },
    parseDialogueQAIssues,
  );
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

/**
 * Опрос батча. 404 (батч потерян — сервис перезапущен) отделён от сетевого
 * сбоя: первый терминален для батча (элемент считается заново), второй терпится
 * до MAX_POLL_FAILURES подряд — иначе один сетевой чих ронял бы стадию.
 */
export async function pollBatchResult<T>(batchId: string, parse: (raw: string) => T): Promise<T> {
  const startedAt = Date.now();
  let failures = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error('timeout');
    await sleep(POLL_INTERVAL_MS);

    let status: BatchStatus | null = null;
    try {
      const { data, error, response } = await getBatchStatus({ path: { batchId } });
      if (response?.status === 404) throw new BatchNotFoundError(`батч ${batchId} не найден на сервере`);
      if (error || !data) throw new Error('пустой ответ /status');
      status = data as BatchStatus;
    } catch (e) {
      if (e instanceof BatchNotFoundError) throw e;
      if (++failures >= MAX_POLL_FAILURES) throw new Error('сервер генерации недоступен');
      continue;
    }
    failures = 0;

    if (status.failed.length > 0) throw new Error(status.failed[0]?.error ?? 'ошибка генерации');
    if (status.done) {
      const raw = status.completed[0]?.result;
      if (!raw) throw new Error('пустой результат');
      return parse(raw);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
