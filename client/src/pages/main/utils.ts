import type { Edge } from '@xyflow/react';
import type { CardNodeData, SceneOutput, CardEdge, CardNode } from './types';

export const getOutputs = (data: CardNodeData & { text?: string }): SceneOutput[] => {
  if (data.outputs) return data.outputs;
  if ('text' in data && data.text !== undefined) {
    return [{ id: 'out_1', text: data.text }];
  }
  return [];
};

export const toCardEdge = ({ id, source, target, sourceHandle, targetHandle }: Edge): CardEdge => ({
  id,
  source,
  target,
  ...(sourceHandle != null ? { sourceHandle } : {}),
  ...(targetHandle != null ? { targetHandle } : {}),
});

export const getVisualMasterPromptForNode = (nodeId: string, edges: CardEdge[], nodes: CardNode[]): string => {
  const incoming = edges.filter(e => e.target === nodeId && e.targetHandle === 'visual_style');
  for (const edge of incoming) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode && sourceNode.data.cardType === 'visual_master_prompt') {
      return sourceNode.data.description ?? '';
    }
  }
  return '';
};

export type SceneChainItem = {
  sceneText: string;
  outputText: string;
};

export type SceneContext = {
  chain: SceneChainItem[];
  depth: number;
  incomingOutputText: string;
};

export const getSceneContext = (nodeId: string, edges: CardEdge[], nodes: CardNode[]): SceneContext => {
  const chain: SceneChainItem[] = [];
  let currentId = nodeId;
  let incomingOutputText = '';

  // Walk backwards through scene_in edges
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Find the edge that targets currentId via scene_in
    const inEdge = edges.find(e => e.target === currentId && e.targetHandle === 'scene_in');
    if (!inEdge) break;

    const sourceNode = nodes.find(n => n.id === inEdge.source);
    if (!sourceNode || sourceNode.data.cardType !== 'scene') break;

    // The sourceHandle is the output ID that was used
    const outputId = inEdge.sourceHandle;
    const output = outputId
      ? sourceNode.data.outputs?.find(o => o.id === outputId)
      : undefined;
    const outputText = output?.text || '';

    // For the first iteration, this is the output that leads INTO our target node
    if (currentId === nodeId) {
      incomingOutputText = outputText;
    }

    chain.unshift({
      sceneText: sourceNode.data.sceneText || sourceNode.data.description || '',
      outputText,
    });

    currentId = sourceNode.id;
  }

  return {
    chain,
    depth: chain.length,
    incomingOutputText,
  };
};

const DEFAULT_MAX_DEPTH = 10;

export const getMaxDepthFromNode = (_nodeId: string, _edges: CardEdge[], _nodes: CardNode[]): number => {
  return DEFAULT_MAX_DEPTH;
};

export const getStoryMasterPromptForNode = (nodeId: string, edges: CardEdge[], nodes: CardNode[]): string => {
  // Walk up the scene chain; if a story_master_prompt node is at the top, use its description
  let currentId = nodeId;
  const visited = new Set<string>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const inEdge = edges.find(e => e.target === currentId && e.targetHandle === 'scene_in');
    if (!inEdge) break;
    const sourceNode = nodes.find(n => n.id === inEdge.source);
    if (!sourceNode) break;

    if (sourceNode.data.cardType === 'story_master_prompt') {
      return sourceNode.data.description ?? '';
    }
    if (sourceNode.data.cardType !== 'scene') break;

    currentId = sourceNode.id;
  }

  return '';
};
