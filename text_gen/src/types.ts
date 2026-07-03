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
 * Запрос на генерацию outline-плана (акты + якорный скелет) из брифа.
 * Бриф и архетипы передаются как opaque JSON-объекты — text_gen их не
 * интерпретирует, а только сериализует в промпт.
 */
export interface OutlineRequest {
  brief: unknown;
  archetypeProfiles: Record<string, unknown>;
  /** Целевые бюджеты: число якорей, распределение по актам, доля сюжетных. */
  targets?: {
    anchorCount: number;
    anchorsPerAct: number[];
    plotOnlyAnchorCount: number;
  };
  /**
   * Previously generated outline that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос на генерацию scene-уровневого DAG между двумя якорями.
 * Все вложенные структуры — opaque JSON (text_gen их не интерпретирует).
 */
export interface SegmentRequest {
  brief: unknown;
  archetypeProfile: unknown | null;
  anchorFrom: unknown;
  anchorTo: unknown;
  existingFlags?: string[];
  /**
   * Baseline state ranges at segment entry: {[stateVarPath]: [lo, hi]}.
   * Computed on the client by reconciling anchorFrom.entryStateRequired with
   * archetype.initialState. Shown to the LLM verbatim in the prompt and used
   * by the validator's range-feasibility check — eliminates hidden 0-default
   * mismatches that previously caused infinite retry loops.
   */
  baselineStateRanges?: Record<string, [number, number]>;
  /**
   * Previously generated segment that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

export interface LiCardsRequest {
  storyMasterPrompt: string;
  count: number;
  hints?: {
    archetypes?: string[];
    constraints?: string;
  };
}

export interface NarrationWebRequest {
  brief: unknown;
  storyAnchorFrom: unknown;
  storyAnchorTo: unknown;
  availableLIs: { liId: string; liName: string; roleInWorld: string }[];
  existingFlags?: string[];
  /**
   * Beat-сцена FROM-якоря, которую игрок только что видел. Паутина должна
   * продолжаться сразу после неё, не повторяя и не противореча.
   */
  fromAnchorBeatText?: string;
  /**
   * LI, встречи с которыми запланированы beat-планом в этом якоре: паутина
   * ОБЯЗАНА содержать encounter-триггер для каждого из них.
   */
  plannedEncounterLIs?: string[];
  /**
   * Previously generated web that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

/**
 * Запрос на планирование битов отношений: раскладка requiredBeats архетипов
 * по encounter-слотам (liId × anchorId) поверх готового outline.
 */
export interface BeatPlanRequest {
  brief: unknown;
  /** StoryOutlinePlan, якоря предварительно топологически отсортированы. */
  outline: unknown;
  /** Профили использованных архетипов (requiredBeats живут здесь). */
  archetypeProfiles: Record<string, unknown>;
  /** Допустимые пары (anchorId × liIds) для встреч. */
  encounterSlots: { anchorId: string; act: number; location: string; liIds: string[] }[];
  /**
   * Previously generated plan that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
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
  /**
   * Previously generated beat that failed validation. Present together
   * with previousIssues during retry-with-feedback flow.
   */
  previousAttempt?: unknown | null;
  /** Issue messages from the previous attempt (verbatim). */
  previousIssues?: string[];
}

export interface DialogueVariantRequest {
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
   * Previously generated variant that failed validation. Present together
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
