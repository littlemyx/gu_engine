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
