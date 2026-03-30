import type { FailedItem } from '@root/image_gen/generated_client';

export type SceneOutput = {
  id: string;
  text: string;
};

export type CharacterPose = {
  id: string;
  description: string;
  image?: string;
};

export type GenerationState = {
  batchId: string;
  status: 'generating' | 'done' | 'failed';
  completedCount?: number;
  totalCount?: number;
  files?: string[];
  errors?: FailedItem[];
  itemIds?: string[];
};

export type CardType = 'scene' | 'character' | 'master_prompt' | 'background';

export type SceneCharacter = {
  id: string;
  name: string;
};

export type CardNodeData = {
  label: string;
  image: string;
  cardType: CardType;
  description: string;
  sceneText?: string;
  outputs: SceneOutput[];
  name?: string;
  poses?: CharacterPose[];
  characters?: SceneCharacter[];
  generation?: GenerationState;
  generatedImages?: string[];
};

export type CardNode = {
  id: string;
  type: CardType;
  position: { x: number; y: number };
  data: CardNodeData;
};

export type CardEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type ExportData = {
  nodes: CardNode[];
  edges: CardEdge[];
};
