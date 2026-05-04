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
