export type { ItemStatus, ItemState, BatchState } from 'gu-engine-gen-shared';

export interface GenerateMelodyRequest {
  style: string;
  instrumental: boolean;
}

export interface GenerateVariationRequest {
  baseAudioName: string;
  toneStyle: string;
  variationType: 'positive' | 'negative';
}

export interface GenerateSfxRequest {
  items: Array<{
    id: string;
    prompt: string;
    soundLoop?: boolean;
  }>;
}
