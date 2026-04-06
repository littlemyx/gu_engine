export interface StoryMasterPromptRequest {
  userHint?: string;
}

export interface SceneChainItem {
  sceneText: string;
  outputText: string;
}

export interface SceneTextRequest {
  storyMasterPrompt: string;
  sceneChain: SceneChainItem[];
  depth: number;
  maxDepth: number;
  incomingOutputText: string;
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
