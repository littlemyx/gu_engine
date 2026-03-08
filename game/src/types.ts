export type SceneOutput = {
  id: string;
  text: string;
};

export type SceneNodeData = {
  label: string;
  image: string;
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
