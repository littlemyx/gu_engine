export type SceneOutput = {
  id: string;
  text: string;
};

export type SceneNodeData = {
  label: string;
  image: string;
  /**
   * Optional foreground character sprite (PNG with transparent background)
   * rendered on top of `image`. Set by procedural-narrative pilot when a
   * scene's charactersPresent contains a generated LI sprite.
   */
  sprite?: string;
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
