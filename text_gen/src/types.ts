export interface StoryMasterPromptRequest {
  userHint?: string;
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
