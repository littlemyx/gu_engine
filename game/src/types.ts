export type SceneType = 'narration' | 'dialogue' | 'branch' | 'router' | 'anchor';

export type OutputEffects = {
  stateDeltas?: Record<string, number>;
  flagSet?: string[];
  flagClear?: string[];
};

export type SceneOutput = {
  id: string;
  text: string;
  effects?: OutputEffects;
};

export type SpriteEntry = {
  url: string;
  position: 'left' | 'center' | 'right';
};

export type SceneNodeData = {
  label: string;
  image: string;
  /** @deprecated Use sprites[] for multi-character. Kept for backward compat. */
  sprite?: string;
  sprites?: SpriteEntry[];
  outputs: SceneOutput[];
  sceneType?: SceneType;
};

export type SceneNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: SceneNodeData;
};

export type StateCondition = {
  path: string;
  gte?: number;
  lte?: number;
};

export type SceneEdge = {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  condition?: StateCondition[];
};

export type SceneGraph = {
  nodes: SceneNode[];
  edges: SceneEdge[];
};

export type StateVarSchema = {
  range: [number, number];
  default: number;
};

export type StateSchema = {
  vars: Record<string, StateVarSchema>;
  flags: string[];
};

/** Компактный манифест мира для карты в игре. Эмитится компилятором
 *  (client/src/narrative/compileWorldGame.ts) в settings.world. Отсутствует →
 *  кнопка карты в плеере скрыта. */
export type WorldMapLocation = {
  id: string;
  name: string;
};

export type WorldMapEdge = {
  from: string;
  to: string;
  via?: string;
};

export type WorldManifest = {
  locations: WorldMapLocation[];
  edges: WorldMapEdge[];
};

export type ProjectSettings = {
  sceneFadeInMs: number;
  sceneFadeOutMs: number;
  choiceAppearDelayMs: number;
  endFadeInMs: number;
  stateSchema?: StateSchema;
  world?: WorldManifest;
};

export type ProjectFile = {
  title: string;
  scenes: string;
  settings: Partial<ProjectSettings>;
};

export type ResolvedProject = {
  title: string;
  scenes: SceneGraph;
  projectFile?: string;
  scenesFile?: string;
  settings: ProjectSettings;
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  sceneFadeInMs: 600,
  sceneFadeOutMs: 400,
  choiceAppearDelayMs: 120,
  endFadeInMs: 400,
};
