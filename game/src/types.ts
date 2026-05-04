export type SceneOutput = {
  id: string;
  text: string;
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
};

export type SceneNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: SceneNodeData;
};

export type SceneEdge = {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
};

export type SceneGraph = {
  nodes: SceneNode[];
  edges: SceneEdge[];
};

export type ProjectSettings = {
  sceneFadeInMs: number;
  choiceAppearDelayMs: number;
  endFadeInMs: number;
};

export type ProjectFile = {
  title: string;
  scenes: string;
  settings: Partial<ProjectSettings>;
};

export type ResolvedProject = {
  title: string;
  scenes: SceneGraph;
  settings: ProjectSettings;
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  sceneFadeInMs: 600,
  choiceAppearDelayMs: 100,
  endFadeInMs: 400,
};
