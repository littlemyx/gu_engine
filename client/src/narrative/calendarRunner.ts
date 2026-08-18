import { resolveScale } from './briefDefaults';
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
  normalizeMaskedExits,
  parseDialogueUnit,
  validateDialogueUnit,
} from './dialogueUnit';
import { buildDialogueUnitRequestPayload, buildLiCardSummary } from './buildDialogueUnitRequest';
import { storageKey } from '@/project/projectScope';
import { addRunCost, formatCost, resetRunCost, STAGE_COST_EST, useRunCost } from './costModel';
import { recordRunCommit } from '@/artifacts/recordRun';
import { emitPipelineEvent } from '@/processes/eventBus';
import { artifactKeyOf, emitRunEvent, type RunEventExtra } from './runEvents';

import { appendRunLog } from './runLog';
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

/**
 * Запрос остановки от пользователя. Прогон не убивается посреди вызова: флаг
 * проверяется между стадиями и элементами, поэтому черновик остаётся целым и
 * «Продолжить» доделывает остаток, не переплачивая за пройденное.
 */
let stopRequested = false;

export class CalendarRunStopped extends Error {
  constructor() {
    super('прогон остановлен автором');
    this.name = 'CalendarRunStopped';
  }
}

/**
 * «Стоп» сразу переводит прогон в error — состояние стора и есть источник
 * правды. Одного module-флага мало: пайплайн — длинная цепочка await-ов с
 * ретраями, и любая гонка вокруг флага возвращала бы прогон к жизни. Пока в
 * сторе не «running», ни одна контрольная точка дальше не пропускает.
 */
export function requestStopCalendarRun(): void {
  stopRequested = true;
  appendRunLog('info', 'запрошена остановка — доигрываем текущий вызов');
  const run = useNarrativeStore.getState().calendarRun;
  if (run?.status === 'running') {
    useNarrativeStore.getState().failCalendarRun(run.phase, 'остановлено автором', []);
  }
}

export const isStopRequested = (): boolean => stopRequested;

/**
 * Бросает CalendarRunStopped, если автор нажал «Стоп» или прогон уже снят
 * из стора другой стороной.
 */
function throwIfStopped(): void {
  if (stopRequested) throw new CalendarRunStopped();
  if (useNarrativeStore.getState().calendarRun?.status !== 'running') {
    throw new CalendarRunStopped();
  }
}

/**
 * Остановка не должна выглядеть как неудачная попытка: в пайплайне много
 * циклов ретрая, которые глушат ошибку элемента и пробуют снова. Каждый такой
 * catch обязан пропустить CalendarRunStopped наружу.
 */
function rethrowIfStopped(e: unknown): void {
  if (e instanceof CalendarRunStopped) throw e;
}

/**
 * Имя Web Lock: один активный прогон на ПРОЕКТ во всех вкладках браузера.
 * Имя скоупится projectId, поэтому вкладки с разными проектами гонят прогоны
 * параллельно и не считают друг друга ведущей вкладкой.
 */
const CALENDAR_LOCK = storageKey('gu-calendar-run');

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
  stopRequested = false;
  try {
    await withCalendarLock(async acquired => {
      // Прогон уже ведёт другая вкладка — не трогаем чужой calendarRun,
      // наблюдатель покажет прогресс через кросс-вкладочный синк.
      if (!acquired) {
        appendRunLog('info', 'прогон ведёт другая вкладка — эта только наблюдает');
        return;
      }
      if (!prepare()) return;
      await runPipeline();
    });
  } catch (e) {
    // Непредвиденный сбой: черновик и pendingBatch сохраняются — «Продолжить»
    // подхватит прогон с той же точки.
    const run = store().calendarRun;
    const stopped = e instanceof CalendarRunStopped;
    const message = stopped ? 'остановлено автором' : e instanceof Error ? e.message : String(e);
    if (run) {
      const done = run.progress.completed;
      appendRunLog(
        stopped ? 'run' : 'error',
        stopped
          ? `прогон остановлен · ${done}/${run.progress.total} · черновик сохранён`
          : `✗ ${run.phase} · ${message} · черновик сохранён`,
      );
      store().failCalendarRun(run.phase ?? 'cast', message, []);
    }
  } finally {
    running = false;
    stopRequested = false;
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
    const continued = shouldReuseDraft(prev, brief, force);
    const resumed: CalendarRunState = continued
      ? {
          ...(prev as CalendarRunState),
          status: 'running',
          error: null,
          issues: [],
          seedIssues: options?.seedIssues,
          plan: options?.plan,
        }
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
          plan: options?.plan,
          dirtyStages: [],
          draft: {},
          pendingBatch: null,
          startedAt: Date.now(),
          runId: newRunId(),
        };
    store().beginCalendarRun(resumed);
    // Продолжение доплачивает за остаток, новый прогон считает деньги с нуля.
    if (!continued) resetRunCost();
    // Первое событие прогона: им машина узнаёт имя прогона (runId рождается
    // здесь, а подпись под сметой ставилась раньше — см. runMachine.applyEvent).
    emitPipelineEvent({
      runId: resumed.runId,
      phase: 'plan',
      stage: 'bundle',
      message: continued ? `продолжаем прогон с стадии ${resumed.phase}` : 'старт прогона',
    });
    appendRunLog(
      'run',
      continued
        ? `продолжаем прогон с стадии ${resumed.phase}`
        : `старт прогона · ${force ? 'полная перегенерация' : 'с нуля'}`,
    );
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
  const runId = run0.runId;
  /** Воля автора из подписанной сметы: что запрещено трогать. */
  const skipSet = new Set(run0.plan?.skip ?? []);
  /** И что пересчитать вопреки валидному кэшу — решение «дубль». */
  const forcedSet = new Set(run0.plan?.force ?? []);

  /** Сколько вызовов транспорта ушло на элемент — «начато» звучит один раз. */
  const attemptsSeen = new Map<string, number>();
  /**
   * Позиции, о судьбе которых уже доложено. Петля «хребет ⇄ планировщик»
   * заходит на spine до трёх раз, и без этого одна позиция считалась бы
   * прогресс-полосой несколько раз.
   */
  const reported = new Set<string>();

  const emitRun = (
    phase: 'start' | 'attempt' | 'fail',
    bulk: BulkCalendarPhase,
    item: string | null,
    extra?: RunEventExtra,
  ) => emitRunEvent(runId, phase, bulk, item, extra);

  /** Позиция закрыта (сделана или пропущена) — ровно один раз за прогон. */
  const report = (phase: 'done' | 'skip', bulk: BulkCalendarPhase, item: string | null, extra: RunEventExtra = {}) => {
    const key = `${bulk}/${item ?? ''}/${extra.artifactKey ?? ''}`;
    if (reported.has(key)) return;
    reported.add(key);
    emitRunEvent(runId, phase, bulk, item, extra);
  };

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

  // Смена стадии — точка, где безопасно остановиться: черновик уже записан.
  const publish = (phase: BulkCalendarPhase, completed: number) => {
    throwIfStopped();
    if (runNow().phase !== phase) appendRunLog('run', `${phase} · ${completed}/${TOTAL_STEPS}`);
    store().patchCalendarRun({ phase, progress: { completed, total: TOTAL_STEPS }, subProgress: null });
  };

  /** Внутристадийный счётчик: диалоги без него час стоят на одной цифре. */
  const publishSub = (label: string, completed: number, total: number) => {
    store().patchCalendarRun({ subProgress: { label, completed, total } });
  };

  const putSoftIssues = (stage: string, issues: string[]) =>
    store().patchCalendarRun({ softIssues: { ...runNow().softIssues, [stage]: issues } });

  /** Позицию автор запретил трогать (замок в смете или решение «оставить моё»). */
  const isKept = (phase: BulkCalendarPhase, item: string | null): boolean => {
    const key = artifactKeyOf(phase, item);
    return key != null && skipSet.has(key);
  };

  /** Автор потребовал дубль: валидный кэш этой позиции не в счёт. */
  const isForced = (phase: BulkCalendarPhase, item: string | null): boolean => {
    const key = artifactKeyOf(phase, item);
    return key != null && forcedSet.has(key);
  };

  /**
   * Запертый скаляр: committed-значение уезжает в черновик как есть — тот же
   * ход, что кэш-хит, потому что коммит заменяет поля стека целиком. Замок
   * сильнее и каскада, и «пересобрать всё»: иначе кнопка полной пересборки
   * тихо стирала бы ровно то, что автор просил не трогать.
   *
   * null означает «запирать было нечего»: артефакта нет в истории. Молча
   * пропустить значило бы оставить дыру, поэтому стадия считается обычным
   * порядком, а автор получает замечание.
   */
  const keepLocked = <K extends DraftScalarField>(phase: BulkCalendarPhase, field: K): CommittedStack[K] | null => {
    if (!isKept(phase, null)) return null;
    const value = committedStack()[field];
    if (value == null) {
      putSoftIssues(phase, [`[warning] ${phase}: запертого артефакта нет в истории — стадия посчитана заново`]);
      return null;
    }
    return value;
  };

  const fail = (phase: BulkCalendarPhase, message: string, stageIssues: string[] = []) => {
    appendRunLog('error', `✗ ${phase} · ${message} · черновик сохранён`);
    emitRun('fail', phase, null, { reason: message });
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
    // Останов проверяется перед каждым вызовом: уже оплаченный ответ дожидаемся.
    throwIfStopped();
    const label = itemKey ? `${phase} · ${itemKey}` : phase;
    const seenKey = `${phase}/${itemKey ?? ''}`;
    // «Начато» — про взятие позиции в работу, а не про удачный вызов: стадия,
    // у которой не поднялся даже транспорт, обязана быть видна в ленте.
    if (!attemptsSeen.has(seenKey)) {
      attemptsSeen.set(seenKey, 0);
      emitRun('start', phase, itemKey);
    }
    /** Номер вызова транспорта по этой позиции. */
    const bumpAttempt = (): number => {
      const n = (attemptsSeen.get(seenKey) ?? 0) + 1;
      attemptsSeen.set(seenKey, n);
      return n;
    };
    const pending = runNow().pendingBatch;
    if (pending && matchPendingBatch(pending, phase, itemKey)) {
      try {
        appendRunLog('pending', `${label} · переподключение к батчу`);
        // Реаттач денег не стоит: за этот батч заплатила прошлая жизнь вкладки.
        emitRun('attempt', phase, itemKey, {
          attempt: bumpAttempt(),
          message: `${label} · переподключение к батчу`,
        });
        const result = await pollBatchResult(pending.batchId, parse);
        store().patchCalendarRun({ pendingBatch: null });
        appendRunLog('ok', `${label} ✓`);
        return result;
      } catch (e) {
        store().patchCalendarRun({ pendingBatch: null });
        // Батч потерян (сервер перезапущен) — считаем элемент заново.
        if (!(e instanceof BatchNotFoundError)) throw e;
        appendRunLog('info', `${label} · батч потерян, считаем заново`);
      }
    }
    const { batchId } = await start();
    addRunCost(phase);
    emitRun('attempt', phase, itemKey, { attempt: bumpAttempt(), cost: STAGE_COST_EST[phase] ?? 0 });
    store().patchCalendarRun({ phase, pendingBatch: { phase, itemKey, batchId } });
    try {
      const result = await pollBatchResult(batchId, parse);
      appendRunLog('ok', `${label} ✓`);
      return result;
    } catch (e) {
      appendRunLog('error', `✗ ${label} · ${e instanceof Error ? e.message : String(e)}`);
      throw e;
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
    const stageCount = arcStageCount(computeCalendarTargets(resolveScale(brief.scale).targetDurationMinutes).days);
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

    const keptCast = keepLocked('cast', 'castPlan');
    if (keptCast) {
      putDraft({ castPlan: keptCast });
      report('skip', 'cast', null, { reason: 'заперто автором' });
    } else if (cachedUsable && cachedErrors.length === 0 && !isForced('cast', null)) {
      putDraft({ castPlan: cached });
      report('skip', 'cast', null, { reason: 'кэш свеж' });
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
          rethrowIfStopped(attemptErr);
          lastAttemptError = attemptErr;
        }
      }
      if (best && best.errorCount === 0) {
        putDraft({ castPlan: best.plan });
        report('done', 'cast', null);
      } else {
        // Деградация: стаб-агенды держат пайплайн живым, автор видит причину.
        const reason = best
          ? best.errors.slice(0, 2).join('; ')
          : lastAttemptError instanceof Error
          ? lastAttemptError.message
          : String(lastAttemptError ?? 'нет ответа');
        putSoftIssues('cast', [`[warning] cast: LLM-стадия не дала валидного плана (${reason}) — использован стаб`]);
        putDraft({ castPlan: buildStubCastPlan(brief) });
        report('done', 'cast', null, { message: 'каст · стаб-агенды (LLM не дала валидного плана)' });
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

    // Стадия одна, а артефакта два, и запирают их по отдельности: каскад каста
    // сносит календарь, но не модель мира. Поэтому запертая половина переживает
    // стадию, даже если вторая половина считается заново.
    const keptWorld = skipSet.has('world/') ? committedStack().worldModel : null;
    const keptCalendar = skipSet.has('calendar/') ? committedStack().calendar : null;
    const keptTagMap = skipSet.has('calendar/') ? committedStack().tagMap : null;
    const withKept = (a: WorldCalendarArtifact): CalendarDraft => ({
      worldModel: keptWorld ?? a.world,
      calendar: keptCalendar ?? a.calendar,
      tagMap: keptTagMap ?? a.tagMap,
    });
    /** О каждой половине пары докладываем отдельной строкой. */
    const reportPair = (phase: 'done' | 'skip', reason?: string) => {
      report(keptCalendar ? 'skip' : phase, 'world_calendar', null, {
        reason: keptCalendar ? 'заперто автором' : reason,
      });
      report(keptWorld ? 'skip' : phase, 'world_calendar', null, {
        artifactKey: 'world/',
        reason: keptWorld ? 'заперто автором' : reason,
      });
    };

    // Дубль любой половины пересчитывает стадию целиком — отдельного запроса
    // «только мир» или «только календарь» у неё нет.
    const pairForced = forcedSet.has('world/') || forcedSet.has('calendar/');

    if (keptWorld && keptCalendar && keptTagMap) {
      putDraft({ worldModel: keptWorld, calendar: keptCalendar, tagMap: keptTagMap });
      reportPair('skip');
    } else if (cached && cachedErrors.length === 0 && !pairForced) {
      putDraft(withKept(cached));
      reportPair('skip', 'кэш свеж');
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
            rethrowIfStopped(attemptErr);
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          putDraft(withKept(best.artifact));
          reportPair('done');
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
        rethrowIfStopped(e);
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
    // Запертый хребет не двигают даже ошибки планировщика: фидбек-петля ниже
    // это учитывает и не гоняет заведомо одинаковые раунды.
    const keptSpine = keepLocked('spine', 'spine');
    if (keptSpine) {
      putDraft({ spine: keptSpine });
      report('skip', 'spine', null, { reason: 'заперто автором' });
      return keptSpine;
    }
    const { value: cachedSpine, source } = scalarCache('spine');
    const cachedSpineErrors = cachedSpine ? spineErrors(cachedSpine) : [];
    // Затравки story QA бьют только по committed-кэшу: хребет, посчитанный в
    // этом же прогоне (draft), их уже учёл — при resume не переплачиваем.
    // Фидбек планировщика, наоборот, бьёт и по draft — он про ЭТОТ хребет.
    const spineSeeds = source === 'committed' ? seedIssues?.spine ?? [] : [];
    const cachedSpineFeedback = [...cachedSpineErrors, ...spineSeeds, ...scheduleFeedback];

    if (cachedSpine && cachedSpineFeedback.length === 0 && !isForced('spine', null)) {
      putDraft({ spine: cachedSpine });
      report('skip', 'spine', null, { reason: 'кэш свеж' });
      return cachedSpine;
    }
    try {
      const basePayload = buildSpineRequestPayload(brief, worldModel, calendar, tagMap ?? null);
      // errorCount сида — только ошибки валидатора: затравки QA и фидбек
      // планировщика инвалидируют кэш и едут в промпт, но структурно чистый
      // кэш не должен валить стадию, если ретраи не дали лучшего. Флаг seeded
      // отличает кэш от свежей попытки: при равном счёте свежая побеждает —
      // кэш-то инвалидирован, иначе петля фидбека никогда бы не перегенерила.
      let best: { plan: SpinePlan; errorCount: number; errors: string[]; seeded?: boolean } | null =
        cachedSpine && cachedSpineFeedback.length > 0
          ? { plan: cachedSpine, errorCount: cachedSpineErrors.length, errors: cachedSpineFeedback, seeded: true }
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
          if (!best || errors.length < best.errorCount || (best.seeded && errors.length === best.errorCount)) {
            best = { plan, errorCount: errors.length, errors };
          }
          if (errors.length === 0) break;
        } catch (attemptErr) {
          rethrowIfStopped(attemptErr);
          lastAttemptError = attemptErr;
        }
      }
      if (best && best.errorCount === 0) {
        putDraft({ spine: best.plan });
        report('done', 'spine', null);
        markRegenerated('spine');
        return best.plan;
      }
      if (!best && lastAttemptError) {
        throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
      }
      fail('spine', `хребет не прошёл валидацию (${best?.errorCount ?? '?'} ошибок)`, best?.errors ?? []);
      return null;
    } catch (e) {
      rethrowIfStopped(e);
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
    const keptSchedule = keepLocked('schedule', 'schedule');
    if (keptSchedule) {
      putDraft({ schedule: keptSchedule });
      report('skip', 'schedule', null, { reason: 'заперто автором' });
      scheduleLoop = keptSchedule;
      break;
    }
    const { value: cachedSchedule } = scalarCache('schedule');
    if (cachedSchedule && scheduleErrorsFor(cachedSchedule, spineLoop).length === 0 && !isForced('schedule', null)) {
      putDraft({ schedule: cachedSchedule });
      report('skip', 'schedule', null, { reason: 'кэш свеж' });
      scheduleLoop = cachedSchedule;
      break;
    }
    const built = buildSchedule(brief, spineLoop, calendar, castPlan, tagMap ?? null);
    const errors = scheduleErrorsFor(built, spineLoop);
    if (errors.length === 0) {
      putDraft({ schedule: built });
      // Планировщик детерминирован и денег не стоит — событие о нём всё равно
      // нужно: в ленте это позиция плана, а не служебный шаг.
      report('done', 'schedule', null);
      markRegenerated('schedule');
      scheduleLoop = built;
      break;
    }
    // Запертый хребет петля исправить не может — каждый следующий раунд вернёт
    // тот же план. Честнее сказать это сразу, чем сжечь два круга впустую.
    if (isKept('spine', null)) {
      fail(
        'schedule',
        `расписание не прошло валидацию (${errors.length} ошибок), а хребет заперт автором — ` +
          `подстроить его под расписание прогон не вправе: снимите замок или поправьте бит вручную`,
        errors,
      );
      return;
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

    const plannedBeats = topoOrderAnchors(derived.outline).length;
    let beatsSeen = 0;

    for (const anchor of topoOrderAnchors(derived.outline)) {
      publishSub('биты хребта', beatsSeen, plannedBeats);
      beatsSeen += 1;
      const outgoingIds = outgoingOf(derived.outline, anchor.id);
      const beatErrors = (b: AnchorBeat): string[] =>
        validateAnchorBeat(b, anchor.id, outgoingIds, liNames)
          .filter(i => i.severity === 'error')
          .map(formatIssue);

      // Запертый бит переживает даже протухший каскад: замок сильнее свежести,
      // поэтому committed-значение берётся мимо mapCache.
      const keptBeat = isKept('beat_prose', anchor.id) ? committedStack().spineBeatProse[anchor.id] : undefined;
      if (keptBeat) {
        acceptedBeats[anchor.id] = keptBeat;
        putDraft({ spineBeatProse: { [anchor.id]: keptBeat } });
        report('skip', 'beat_prose', anchor.id, { reason: 'заперто автором' });
        continue;
      }

      // anchor.id === beat.id по построению адаптера — кэш ищем по нему же.
      const cached = mapCache('spineBeatProse').value[anchor.id];
      const cachedErrors = cached ? beatErrors(cached) : [];
      if (cached && cachedErrors.length === 0 && !isForced('beat_prose', anchor.id)) {
        acceptedBeats[anchor.id] = cached;
        putDraft({ spineBeatProse: { [anchor.id]: cached } });
        report('skip', 'beat_prose', anchor.id, { reason: 'кэш свеж' });
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
            rethrowIfStopped(attemptErr);
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          acceptedBeats[anchor.id] = best.beat;
          putDraft({ spineBeatProse: { [anchor.id]: best.beat } });
          report('done', 'beat_prose', anchor.id);
        } else if (best) {
          stageIssues.push(`${anchor.id}: проза бита не прошла валидацию: ${best.errors.slice(0, 2).join('; ')}`);
        } else {
          throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
        }
      } catch (e) {
        rethrowIfStopped(e);
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
    const keptAnchors = keepLocked('anchor_transitions', 'anchorNarrations');
    const cachedAnchors = scalarCache('anchorNarrations').value;
    if (keptAnchors) {
      putDraft({ anchorNarrations: keptAnchors });
      report('skip', 'anchor_transitions', null, { reason: 'заперто автором' });
    } else if (cachedAnchors && Object.keys(cachedAnchors).length > 0 && !isForced('anchor_transitions', null)) {
      putDraft({ anchorNarrations: cachedAnchors });
      report('skip', 'anchor_transitions', null, { reason: 'кэш свеж' });
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
        report('done', 'anchor_transitions', null);
      } catch (e) {
        rethrowIfStopped(e);
        // Стадия не блокирующая: у компилятора есть статичные подписи. В ленте
        // это пропуск с причиной, а не сбой прогона.
        report('skip', 'anchor_transitions', null, {
          reason: `не сгенерированы (${e instanceof Error ? e.message : String(e)}) — статичные подписи`,
        });
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

    /**
     * Запертые встречи этого персонажа. Замок держит юнит, но не отменяет
     * пересчёт остального пула: генерация идёт пулом на персонажа, а запирают
     * отдельную встречу. Поэтому запертые committed-юниты вливаются в черновик
     * ПОВЕРХ сгенерированных — по совпадающему id побеждает запертый.
     */
    const keptUnitsOf = (liId: string): EventUnit[] =>
      Object.values(committedStack().eventUnits).filter(
        u => u.participants[0] === liId && skipSet.has(`event_pool/${u.id}`),
      );

    /**
     * «Дубль» на встрече — это пересчёт всего пула её владельца: пул
     * генерируется целиком, запроса «только эту встречу» у стадии нет.
     */
    const forcedLis = new Set(
      Object.values(committedStack().eventUnits)
        .filter(u => forcedSet.has(`event_pool/${u.id}`))
        .map(u => u.participants[0])
        .filter(Boolean),
    );

    const keepUnits = (units: EventUnit[]) => {
      if (units.length === 0) return;
      putDraft({ eventUnits: Object.fromEntries(units.map(u => [u.id, u])) });
      for (const u of units) {
        report('skip', 'event_pool', u.id, { artifactKey: `event_pool/${u.id}`, reason: 'заперто автором' });
      }
    };

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
      if (cachedPool.length > 0 && cachedPoolFeedback.length === 0 && !forcedLis.has(li.id)) {
        finalUnits.push(...cachedPool);
        putDraft({ eventUnits: Object.fromEntries(cachedPool.map(u => [u.id, u])) });
        // Адреса «позиция = один LI» в учёте нет (там ключ — юнит), поэтому
        // событие едет без artifactKey, но с человеческой подписью.
        report('skip', 'event_pool', li.id, { message: `пропущено: пул ${li.id} — кэш свеж` });
        keepUnits(keptUnitsOf(li.id));
        continue;
      }

      try {
        const basePayload = buildEventPoolRequestPayload(brief, li, castPlan, schedule, spine, calendar);
        // errorCount сида — ТОЛЬКО настоящие ошибки валидатора: замечания и
        // затравки едут фидбеком, но приёмку не решают. Иначе кэш с одним
        // warning (живой случай: пул раздуло до 21 юнита) валил стадию, когда
        // ретраи не дали идеала, — non-blocking замечание становилось блокером.
        let best: { units: EventUnit[]; errorCount: number; errors: string[] } | null =
          cachedPool.length > 0
            ? { units: cachedPool, errorCount: poolErrors(cachedPool).length, errors: cachedPoolFeedback }
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
            rethrowIfStopped(attemptErr);
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          finalUnits.push(...best.units);
          putDraft({ eventUnits: Object.fromEntries(best.units.map(u => [u.id, u])) });
          report('done', 'event_pool', li.id, { message: `готово: пул ${li.id} · юнитов ${best.units.length}` });
          keepUnits(keptUnitsOf(li.id));
        } else if (best) {
          stageIssues.push(`${li.id}: пул не прошёл валидацию: ${best.errors.slice(0, 3).join('; ')}`);
        } else {
          throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
        }
      } catch (e) {
        rethrowIfStopped(e);
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
    const rekindWarned = new Set<string>();

    const plannedUnits = eventUnits.filter(
      u => reachable.has(u.id) && u.kind === 'dialogue' && liById.has(u.participants[0] ?? ''),
    ).length;
    let unitsSeen = 0;

    for (const unit of eventUnits) {
      if (!reachable.has(unit.id) || unit.kind !== 'dialogue') continue;
      const li = liById.get(unit.participants[0] ?? '');
      if (!li) continue;

      // Счётчик — до работы над юнитом: «сколько закрыто» из скольких.
      publishSub('юниты диалогов', unitsSeen, plannedUnits);
      unitsSeen += 1;

      const unitKey = unit.id;
      // Запертая проза встречи не переписывается — мимо кэша и каскада.
      const keptProse = isKept('dialogue_units', unit.id) ? committedStack().unitProse[unit.id] : undefined;
      if (keptProse && keptProse.length > 0) {
        putDraft({ unitProse: { [unit.id]: keptProse } });
        report('skip', 'dialogue_units', unit.id, { reason: 'заперто автором' });
        continue;
      }

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

      const forcedUnit = isForced('dialogue_units', unit.id);
      const cachedComplete =
        !forcedUnit &&
        unitSeeds.length === 0 &&
        cached.length === 3 &&
        BRACKETS.every(b => {
          const u = cached.find(x => x.bracket === b);
          return u != null && unitErrors(u).length === 0;
        });
      if (cachedComplete) {
        putDraft({ unitProse: { [unitKey]: cached } });
        report('skip', 'dialogue_units', unitKey, { reason: 'кэш свеж' });
        continue;
      }

      // Позиция плана — юнит целиком, а не брекет: в учёте у него один адрес.
      const issuesBefore = stageIssues.length;
      const units: DialogueUnit[] = [];
      for (const bracket of BRACKETS) {
        // Холодная проза для ступени, вход на которую требует тепла выше
        // холодного порога, — деньги на ветер: такую ветку игрок не увидит
        // никогда. Предикат общий с story QA, иначе QA потребует прозу, которую
        // мы намеренно не генерим, и погонит бесконечную перегенерацию.
        if (bracket === 'negative' && skipsNegativeBracket(unit, brief, calendar, eventUnits)) continue;

        // Валидный кэшированный брекет не трогаем (если нет затравок QA).
        // Нормализации применяем и к кэшу: юниты, записанные до появления
        // правил (или до их правки), несут хорошую прозу и ломаются только
        // механикой — этикетки выходов и арифметика дельт чинятся на месте,
        // без повторной генерации.
        const cachedRaw = cached.find(u => u.bracket === bracket);
        const cachedForBracket = cachedRaw
          ? normalizeChoicePathDeltas(normalizeMaskedExits(cachedRaw).unit).unit
          : undefined;
        if (!forcedUnit && unitSeeds.length === 0 && cachedForBracket && unitErrors(cachedForBracket).length === 0) {
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
            // Выбор, ведущий в closing-узел не-farewell этикеткой, — верный
            // граф с неверной подписью: чинится переименованием на месте
            // (см. normalizeMaskedExits), а не перегенерацией.
            const { unit: unmasked, rekinded } = normalizeMaskedExits(acyclic);
            if (rekinded.length > 0 && !rekindWarned.has(`${unitKey}/${bracket}`)) {
              rekindWarned.add(`${unitKey}/${bracket}`);
              dialogueSoft.push(
                `[warning] dialogue: ${unitKey}/${bracket}: выходы переименованы в farewell (${rekinded.join(', ')})`,
              );
              putSoftIssues('dialogue_units', dialogueSoft);
            }
            // Та же логика, что с циклами: сумма дельт по пути — свойство арки,
            // а не текста, и правится арифметикой. Ужимаем пропорционально
            // (см. normalizeChoicePathDeltas), а не заворачиваем юнит.
            const { unit: normalized, scaled } = normalizeChoicePathDeltas(unmasked);
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
              rethrowIfStopped(attemptErr);
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
          rethrowIfStopped(e);
          stageIssues.push(`${unitKey}/${bracket}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (stageIssues.length === issuesBefore) report('done', 'dialogue_units', unitKey);
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
      const keptEnding = isKept('ending_prose', key) ? committedStack().endings[key] : undefined;
      if (keptEnding) {
        putDraft({ endings: { [key]: keptEnding } });
        report('skip', 'ending_prose', key, { reason: 'заперто автором' });
        continue;
      }
      const cached = mapCache('endings').value[key];
      if (cached && endingErrors(cached, task.kind).length === 0 && !isForced('ending_prose', key)) {
        putDraft({ endings: { [key]: cached } });
        report('skip', 'ending_prose', key, { reason: 'кэш свеж' });
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
            rethrowIfStopped(attemptErr);
            lastAttemptError = attemptErr;
          }
        }
        if (best && best.errorCount === 0) {
          // liId генератора может отсутствовать/врать — фиксируем свой.
          putDraft({ endings: { [key]: { ...best.ending, kind: task.kind, liId: task.liId } } });
          report('done', 'ending_prose', key);
        } else if (best) {
          stageIssues.push(`${key}: эпилог не прошёл валидацию: ${best.errors.slice(0, 2).join('; ')}`);
        } else {
          throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
        }
      } catch (e) {
        rethrowIfStopped(e);
        stageIssues.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (stageIssues.length > 0) {
      fail('ending_prose', `эпилоги концовок не собраны полностью (${stageIssues.length} проблем)`, stageIssues);
      return;
    }
  }

  const finishedRunId = runNow().runId;
  const keepFresh = runNow().plan?.keepFresh ?? [];
  // Единственная запись в committed-стек за весь прогон.
  store().commitCalendarRun();
  // Учёт коммитится тем же шагом, что и стек: иначе история и знание о том,
  // из чего она собрана, разъедутся при первом же обрыве.
  const spent = useRunCost.getState().spent;
  // runId и план читаются до коммита: после него состояние прогона обнуляется.
  recordRunCommit(finishedRunId, spent, keepFresh);
  emitPipelineEvent({
    runId: finishedRunId,
    phase: 'commit',
    stage: 'bundle',
    cost: spent,
    message: 'история обновлена',
  });
  appendRunLog('ok', `прогон завершён · история обновлена · ≈ ${formatCost(spent)}`);
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
