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
