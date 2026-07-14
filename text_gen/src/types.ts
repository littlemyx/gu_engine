export interface StoryMasterPromptRequest {
  userHint?: string;
}

export interface SceneChainItem {
  sceneText: string;
  outputText: string;
}

export interface SceneCharacter {
  name: string;
  description?: string;
}

export interface SceneTextRequest {
  storyMasterPrompt: string;
  sceneChain: SceneChainItem[];
  depth: number;
  maxDepth: number;
  incomingOutputText: string;
  characters?: SceneCharacter[];
}

/**
 * Запрос стадии worldCalendar: локации мира + дискретный календарь
 * (дни × части дня, границы актов) + маппинг агендных тегов на локации.
 * Все вложенные структуры — opaque JSON (text_gen их не интерпретирует).
 */
export interface WorldCalendarRequest {
  brief: unknown;
  /** CastPlan с агендными тегами LI, или null (стаб-агенды без LLM). */
  castPlan: unknown | null;
  /** Целевые размеры календаря (computeCalendarTargets + brief.scale.acts). */
  targets: {
    days: number;
    daypartsPerDay: number;
    slotCount: number;
    acts: number;
  };
  /**
   * Previously generated world+calendar that failed validation. Present
   * together with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос стадии castPlan (A1): персоны + цели по стадиям арки +
 * weekly-паттерны по абстрактным тегам локаций. Бриф и архетипы —
 * opaque JSON (тот же trimming-паттерн, что у OutlineRequest).
 */
export interface CastPlanRequest {
  brief: unknown;
  /** Только профили архетипов, использованных LI брифа. */
  archetypeProfiles: Record<string, unknown>;
  /**
   * Previously generated cast plan that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос стадии eventPool (B2): пул событий-storylet-ов ОДНОГО персонажа —
 * шеллы guard+goal+effects без прозы. Контекст O(1): карточка LI + агенда,
 * выжимка его расписания, релевантные биты хребта и размеры календаря.
 */
export interface EventPoolRequest {
  brief: unknown;
  /** Карточка LI из брифа (opaque JSON). */
  liCard: unknown;
  /** Агенда этого персонажа из castPlan (goals/weeklyPattern/locationTags). */
  agenda: unknown;
  /** Слоты, где персонаж на сцене: только non-null позиции расписания. */
  scheduleExcerpt: { slot: number; locationId: string }[];
  /** Биты хребта с участием персонажа: id/summary/window. */
  spineBeats: { id: string; summary: string; window: { fromSlot: number; toSlot: number } }[];
  /** Размеры календаря. */
  calendar: { slotCount: number; dayparts: string[]; actBoundaries: number[] };
  /** Целевые бюджеты: юнитов на стадию арки. */
  targets: { unitsPerStage: number };
  /**
   * Previously generated pool that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос стадии spine: хребет истории — биты с окнами слотов и
 * guarded-концовки поверх готового мира и календаря.
 */
export interface SpineRequest {
  brief: unknown;
  /** WorldModel (locations) — биты ссылаются на id локаций. */
  worldModel: unknown;
  /** Calendar (days/dayparts/slotCount/actBoundaries). */
  calendar: unknown;
  /** Маппинг агендных тегов на локации, или null. */
  tagMap: unknown | null;
  /** Целевые бюджеты: число битов и лимит развилок (0 в фазе 1). */
  targets: {
    beatCount: number;
    branchPointBudget: number;
  };
  /**
   * Previously generated spine that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос на генерацию beat-сцены якоря: событие anchor.summary,
 * разыгранное на экране от 2-го лица, + диегетические подписи переходов
 * к исходящим якорям.
 */
export interface AnchorBeatRequest {
  brief: unknown;
  /** StoryAnchor: id, type, act, location, timeMarker, summary, establishes, availableLIs. */
  anchor: unknown;
  /** outline.acts[anchor.act - 1].purpose — функция сцены в акте. */
  actPurpose: string;
  /** Цепочка предков (топологический порядок, последние 4). */
  predecessorBeats: { anchorId: string; summary: string; beatText?: string }[];
  /** Целевые якоря исходящих рёбер — для подписей переходов. */
  outgoingTargets: { anchorId: string; summary: string; location: string; timeMarker: string }[];
  /** Локация якоря — сущность из модели мира. */
  location?: { id: string; name: string; description: string; pointsOfInterest: string[] };
  /** Как игрок физически прибывает (via последнего плеча маршрута). */
  arrivedVia?: string;
  /**
   * Previously generated beat that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос стадии dialogueUnit (эволюция dialogueVariant, фаза 3
 * calendar-branching): те же контекстные поля, но выходной контракт —
 * DialogueUnit с typed choices (kind: ask|say|react|farewell), обязательным
 * next у каждого выбора и явными closing-узлами. Понятия nextSceneId:null
 * больше не существует.
 */
export interface DialogueUnitRequest {
  brief: unknown;
  liCard: unknown;
  archetypeProfile: unknown;
  storyContext: {
    location: string;
    timeMarker: string;
    recentEvents: string;
  };
  bracket: 'positive' | 'neutral' | 'negative';
  stateRanges: Record<string, [number, number]>;
  /**
   * Контекст встречи из beat-плана: номер встречи, целевой бит арки и
   * краткая история предыдущих встреч. Отсутствует при генерации без плана.
   */
  encounterContext?: {
    encounterIndex: number;
    totalPlannedEncounters: number;
    beatType?: string | null;
    beatPurpose?: string;
    goal?: string;
    liArcSummary?: string;
    priorEncounters: { anchorId: string; location: string; timeMarker: string; goal: string }[];
    anchorBeatText?: string;
  };
  /**
   * Previously generated unit that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос стадии dialogueQA (D1): LLM-критик готового диалогового юнита.
 * Вход — сам юнит + брекет + выжимка карточки LI; выход — строгий JSON
 * {"issues": [{severity, scope, message}]}.
 */
export interface DialogueQARequest {
  /** Сгенерированный DialogueUnit (opaque JSON). */
  unit: unknown;
  bracket: 'positive' | 'neutral' | 'negative';
  /** Выжимка карточки LI: имя, характер, речевой стиль. */
  liCardSummary: string;
}

/**
 * Запрос стадии storyLeafQA (D4): LLM-критик сюжета одного листа ветвления.
 * Вход — лента summary битов листа в хронологии + концовки + тон брифа;
 * выход — строгий JSON {"issues": [{severity, scope, message}]}.
 */
export interface StoryLeafQARequest {
  /** «bp1=o1, bp2=o2» — какая комбинация исходов образует лист. */
  leafLabel: string;
  /** Биты листа в порядке назначенных слотов. */
  beatSummariesOrdered: { id: string; summary: string; timeMarker: string }[];
  /** Концовки хребта (kind: good/normal/bad). */
  endings: { id: string; kind: string; summary?: string }[];
  /** Тон мира из брифа (настроение, темы, интенсивность). */
  briefTone: string;
}

/**
 * Запрос на генерацию эпилога (одна концовка за вызов).
 * kind=good генерится per-LI; normal/bad — общие.
 */
export interface EndingRequest {
  brief: unknown;
  /** title, logline, acts, resolution-якорь. */
  outline: unknown;
  kind: 'good' | 'normal' | 'bad';
  /** Карточка LI — только для kind=good. */
  liCard?: unknown | null;
  /** Тон концовки из archetype.endingProfile[kind].tone. */
  endingTone?: string;
  /** Арка отношений LI из beat-плана. */
  liArcSummary?: string;
  /** Goal последней запланированной встречи этого LI. */
  finalEncounterGoal?: string;
  /** Beat-сцена resolution-якоря — эпилог продолжает её. */
  resolutionBeatText?: string;
  /**
   * Previously generated ending that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

export type ItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ItemState {
  id: string;
  status: ItemStatus;
  result?: string;
  error?: string;
}

export interface BatchState {
  batchId: string;
  createdAt: string;
  items: Record<string, ItemState>;
}
