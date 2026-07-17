import type { AnchorBeat, Brief, EndingVariant, WorldModel } from './types';
import type { AnchorNarrations, Calendar, CastPlan, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import type { DialogueUnit } from './dialogueUnit';

/**
 * Состояние календарного прогона: черновик + позиция + привязка к живому батчу.
 *
 * Зачем: прогон стоит десятки LLM-вызовов и минуты ожидания, поэтому (1) он не
 * имеет права сносить готовую историю авансом — новый стек собирается в draft
 * и коммитится в committed-поля стора одним set() только по успеху всех стадий;
 * (2) он должен переживать перезагрузку страницы — draft и pendingBatch
 * персистятся, init-система дожимает прогон с того места, где он оборвался.
 *
 * Каскады инвалидации при этом переезжают из сеттеров стора сюда: раньше
 * setSpine() и соседи сами сносили нижележащие стадии, гарантируя, что
 * протухший кэш не переиспользуется. Теперь runner помечает регенерированные
 * стадии в dirtyStages, а effectiveScalar/effectiveMap запрещают читать
 * committed-кэш нижележащих полей — гарантия та же, но без разрушения данных.
 */

export const TOTAL_STEPS = 9;

export type BulkCalendarPhase =
  | 'idle'
  | 'cast'
  | 'world_calendar'
  | 'spine'
  | 'schedule'
  | 'beat_prose'
  | 'anchor_transitions'
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
 * его с фидбеком, сохранив как previousAttempt.
 *
 * Затравки бьют только по committed-кэшу: артефакт, уже сгенерированный В ЭТОМ
 * прогоне (лежит в draft), их учёл — при resume регенерировать его снова не надо.
 */
export type BulkCalendarRunOptions = {
  seedIssues?: {
    spine?: string[];
    /** unitId → issue-строки для его диалоговой прозы. */
    dialogue?: Record<string, string[]>;
    /** liId → issue-строки для его пула событий (sim-мёртвые слоты, deadContent). */
    eventPool?: Record<string, string[]>;
  };
  /**
   * Полная перегенерация: committed-кэши стадий игнорируются, всё считается
   * заново. Данные при этом НЕ сносятся — старая история живёт до коммита.
   * Медиа (фоны/спрайты/аудио) прогон не трогает вовсе.
   */
  force?: boolean;
};

/** Скалярные поля стека (один артефакт на прогон). */
export type DraftScalarField =
  | 'castPlan'
  | 'worldModel'
  | 'calendar'
  | 'tagMap'
  | 'spine'
  | 'schedule'
  | 'anchorNarrations';
/** Поэлементные поля стека (накапливаются по ходу стадии, ключ — id элемента). */
export type DraftMapField = 'eventUnits' | 'unitProse' | 'spineBeatProse' | 'endings';
export type DraftField = DraftScalarField | DraftMapField;

/** Committed-стек стора — вход правил кэширования и цель коммита. */
export type CommittedStack = {
  castPlan: CastPlan | null;
  worldModel: WorldModel | null;
  calendar: Calendar | null;
  tagMap: Record<string, string[]> | null;
  spine: SpinePlan | null;
  schedule: CharacterSchedule | null;
  eventUnits: Record<string, EventUnit>;
  unitProse: Record<string, DialogueUnit[]>;
  spineBeatProse: Record<string, AnchorBeat>;
  endings: Record<string, EndingVariant>;
  /** Нарации якорных переходов; пусто → компилятор берёт статичные фолбэки. */
  anchorNarrations: AnchorNarrations | null;
};

/** Черновик прогона: то же, что стек, но каждое поле опционально. */
export type CalendarDraft = {
  castPlan?: CastPlan;
  worldModel?: WorldModel;
  calendar?: Calendar;
  tagMap?: Record<string, string[]>;
  spine?: SpinePlan;
  schedule?: CharacterSchedule;
  eventUnits?: Record<string, EventUnit>;
  unitProse?: Record<string, DialogueUnit[]>;
  spineBeatProse?: Record<string, AnchorBeat>;
  endings?: Record<string, EndingVariant>;
  anchorNarrations?: AnchorNarrations;
};

/** Стадии с нисходящим каскадом инвалидации (бывшие каскадные сеттеры стора). */
export type CalendarCascadeStage = 'cast' | 'world_calendar' | 'spine' | 'schedule';

/**
 * Живой батч на сервере генерации. itemKey различает и элемент стадии, и
 * parse-контекст (у диалогового брекета их три: генерация, QA-критик,
 * QA-регенерация) — reattach допустим только при точном совпадении, иначе
 * результат распарсится не тем парсером.
 */
export type CalendarPendingBatch = {
  phase: BulkCalendarPhase;
  itemKey: string | null;
  batchId: string;
};

export type CalendarRunState = {
  status: 'running' | 'error' | 'done';
  force: boolean;
  /** Текущая (или упавшая) стадия. */
  phase: BulkCalendarPhase;
  progress: BulkCalendarProgress;
  error: string | null;
  /** Плоский список для UI — заполняется на done/fail. */
  issues: string[];
  /** Нефатальные проблемы по стадиям: resume перезаписывает ключ, а не дублит. */
  softIssues: Record<string, string[]>;
  /** Снапшот брифа на старте: resume не должен смешивать два разных брифа. */
  brief: Brief;
  seedIssues?: BulkCalendarRunOptions['seedIssues'];
  dirtyStages: CalendarCascadeStage[];
  draft: CalendarDraft;
  pendingBatch: CalendarPendingBatch | null;
  startedAt: number;
  /** Диагностика (в т.ч. мультивкладочности) — в логике не участвует. */
  runId: string;
};

/** Поля, которые сносил каскад соответствующего сеттера стора (см. narrativeStore). */
const CASCADE: Record<CalendarCascadeStage, DraftField[]> = {
  // setCastPlan: calendar/tagMap + всё от spine вниз + endings. worldModel не трогался.
  cast: ['calendar', 'tagMap', 'spine', 'schedule', 'eventUnits', 'unitProse', 'spineBeatProse', 'endings'],
  // setWorldCalendar: CLEARED_FROM_SPINE + endings.
  world_calendar: ['spine', 'schedule', 'eventUnits', 'unitProse', 'spineBeatProse', 'endings'],
  // setSpine: CLEARED_FROM_SPINE + endings (сам spine — записываемое поле).
  spine: ['schedule', 'eventUnits', 'unitProse', 'spineBeatProse', 'endings'],
  // setSchedule: eventUnits/unitProse.
  schedule: ['eventUnits', 'unitProse'],
};

/** Поля, committed-кэш которых протух из-за регенерации перечисленных стадий. */
export function cascadeDirtyFields(stages: CalendarCascadeStage[]): Set<DraftField> {
  const dirty = new Set<DraftField>();
  for (const stage of stages) {
    for (const field of CASCADE[stage]) dirty.add(field);
  }
  return dirty;
}

/** Можно ли читать committed-кэш поля: force и протухшие каскады его запрещают. */
export function committedAllowed(field: DraftField, force: boolean, dirtyStages: CalendarCascadeStage[]): boolean {
  return !force && !cascadeDirtyFields(dirtyStages).has(field);
}

export type CacheSource = 'draft' | 'committed' | 'none';

/**
 * Эффективный кэш скалярного поля: draft прогона важнее committed, committed
 * доступен только когда его не запретили force/каскад.
 */
export function effectiveScalar<K extends DraftScalarField>(
  field: K,
  draft: CalendarDraft,
  committed: CommittedStack,
  force: boolean,
  dirtyStages: CalendarCascadeStage[],
): { value: CommittedStack[K] | null; source: CacheSource } {
  const fromDraft = draft[field];
  if (fromDraft != null) return { value: fromDraft as CommittedStack[K], source: 'draft' };
  if (!committedAllowed(field, force, dirtyStages)) return { value: null, source: 'none' };
  const fromCommitted = committed[field];
  if (fromCommitted == null) return { value: null, source: 'none' };
  return { value: fromCommitted, source: 'committed' };
}

/**
 * Эффективный кэш поэлементного поля. draftKeys — элементы, посчитанные В ЭТОМ
 * прогоне: по ним затравки QA уже применены (см. BulkCalendarRunOptions).
 */
export function effectiveMap<K extends DraftMapField>(
  field: K,
  draft: CalendarDraft,
  committed: CommittedStack,
  force: boolean,
  dirtyStages: CalendarCascadeStage[],
): { value: CommittedStack[K]; draftKeys: Set<string> } {
  const fromDraft = (draft[field] ?? {}) as CommittedStack[K];
  const draftKeys = new Set(Object.keys(fromDraft));
  if (!committedAllowed(field, force, dirtyStages)) return { value: fromDraft, draftKeys };
  return { value: { ...committed[field], ...fromDraft } as CommittedStack[K], draftKeys };
}

/**
 * Можно ли продолжить прошлый прогон вместо чистого старта. Совпасть должны
 * бриф и режим force — иначе черновик собран под другие входы и переиспользовать
 * его нельзя. Завершённый прогон (done) не продолжают: его стек уже в committed.
 */
export function shouldReuseDraft(prev: CalendarRunState | null, brief: Brief, force: boolean): boolean {
  if (!prev || prev.status === 'done') return false;
  if (prev.force !== force) return false;
  // Бриф собирается одним стором из одних и тех же литералов — порядок ключей
  // стабилен, структурного сравнения не требуется.
  return JSON.stringify(prev.brief) === JSON.stringify(brief);
}

export function flattenSoftIssues(softIssues: Record<string, string[]>): string[] {
  return Object.values(softIssues).flat();
}

export function hasAnyDraft(draft: CalendarDraft | undefined): boolean {
  if (!draft) return false;
  return Object.values(draft).some(v => (v != null && typeof v === 'object' ? Object.keys(v).length > 0 : v != null));
}

/** Reattach допустим только при точном совпадении стадии и элемента (parse-контекст). */
export function matchPendingBatch(
  pending: CalendarPendingBatch | null,
  phase: BulkCalendarPhase,
  itemKey: string | null,
): boolean {
  if (!pending) return false;
  return pending.phase === phase && pending.itemKey === itemKey;
}

/**
 * Патч коммита: черновик самодостаточен (стадия кладёт в него и то, что
 * переиспользовала из committed), поэтому pipeline-поля заменяются целиком —
 * никаких merge-правил, никаких осиротевших ключей от прошлых прогонов.
 */
export function buildCommitPatch(run: CalendarRunState): CommittedStack & { calendarRun: CalendarRunState } {
  const d = run.draft;
  return {
    castPlan: d.castPlan ?? null,
    worldModel: d.worldModel ?? null,
    calendar: d.calendar ?? null,
    tagMap: d.tagMap ?? null,
    anchorNarrations: d.anchorNarrations ?? null,
    spine: d.spine ?? null,
    schedule: d.schedule ?? null,
    eventUnits: d.eventUnits ?? {},
    unitProse: d.unitProse ?? {},
    spineBeatProse: d.spineBeatProse ?? {},
    endings: d.endings ?? {},
    calendarRun: {
      ...run,
      status: 'done',
      phase: 'done',
      progress: { completed: TOTAL_STEPS, total: TOTAL_STEPS },
      error: null,
      issues: flattenSoftIssues(run.softIssues),
      draft: {},
      pendingBatch: null,
    },
  };
}
