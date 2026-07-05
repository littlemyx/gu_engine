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

export type CardType =
  | 'scene'
  | 'character'
  | 'visual_master_prompt'
  | 'story_master_prompt'
  | 'background'
  | 'audio_master_prompt';

export type SceneCharacter = {
  id: string;
  name: string;
};

export type AudioTone = 'positive' | 'negative';

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
  audioPositiveTone?: string;
  audioNegativeTone?: string;
  /** База (audio_master_prompt): 2 Suno-варианта одной генерации. */
  generatedAudio?: string[];
  audioGeneration?: GenerationState;
  /** Вариации персонажа, раздельно по тонам (каждый тон — 2 Suno-варианта). */
  audioVariations?: Partial<Record<AudioTone, string[]>>;
  audioGenerationByTone?: Partial<Record<AudioTone, GenerationState>>;
  /** Выбранный вариант (индекс) для базы и каждого тона. */
  audioSelected?: { base?: number; positive?: number; negative?: number };
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
