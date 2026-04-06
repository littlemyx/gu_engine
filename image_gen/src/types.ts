export interface GenerateItem {
  id: string;
  description: string;
  referenceImages?: string[];
}

export interface GenerateRequest {
  masterPrompt?: string;
  negativePrompt?: string;
  items: GenerateItem[];
}

export type ItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ItemState {
  id: string;
  status: ItemStatus;
  filePath?: string;
  error?: string;
}

export interface BatchState {
  batchId: string;
  createdAt: string;
  items: Record<string, ItemState>;
}

export interface CharacterGenerateRequest {
  masterPrompt: string;
  storyMasterPrompt?: string;
  characterDescription: string;
  poses?: string[];
}

export interface RegeneratePoseRequest {
  masterPrompt: string;
  storyMasterPrompt?: string;
  characterDescription: string;
  pose: string;
  referenceImageUrl: string;
}

export interface BackgroundGenerateRequest {
  masterPrompt: string;
  sceneDescription: string;
}
