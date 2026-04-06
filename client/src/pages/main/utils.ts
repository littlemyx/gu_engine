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

export const getMaxDepthFromNode = (nodeId: string, edges: CardEdge[], nodes: CardNode[]): number => {
  // BFS/DFS to find the longest path from the root of the chain
  const visited = new Set<string>();
  let maxDepth = 0;

  const dfs = (id: string, depth: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    maxDepth = Math.max(maxDepth, depth);

    // Find all scene_in edges where this node is the source
    const outEdges = edges.filter(e => e.source === id);
    for (const edge of outEdges) {
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode && targetNode.data.cardType === 'scene' && edge.targetHandle === 'scene_in') {
        dfs(targetNode.id, depth + 1);
      }
    }
  };

  // Walk to the root first
  let rootId = nodeId;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const inEdge = edges.find(e => e.target === rootId && e.targetHandle === 'scene_in');
    if (!inEdge) break;
    const sourceNode = nodes.find(n => n.id === inEdge.source);
    if (!sourceNode || sourceNode.data.cardType !== 'scene') break;
    rootId = sourceNode.id;
  }

  dfs(rootId, 0);
  // Return at least 10 as default max depth estimate
  return Math.max(maxDepth, 10);
};

export const getStoryMasterPromptForNode = (nodeId: string, edges: CardEdge[], nodes: CardNode[]): string => {
  // Check direct connection first
  const incoming = edges.filter(e => e.target === nodeId && e.targetHandle === 'story_style');
  for (const edge of incoming) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode && sourceNode.data.cardType === 'story_master_prompt') {
      return sourceNode.data.description ?? '';
    }
  }

  // Walk up the scene chain to find an ancestor with a story master prompt
  let currentId = nodeId;
  const visited = new Set<string>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const inEdge = edges.find(e => e.target === currentId && e.targetHandle === 'scene_in');
    if (!inEdge) break;
    const sourceNode = nodes.find(n => n.id === inEdge.source);
    if (!sourceNode || sourceNode.data.cardType !== 'scene') break;

    const parentPrompt = edges.filter(e => e.target === sourceNode.id && e.targetHandle === 'story_style');
    for (const edge of parentPrompt) {
      const promptNode = nodes.find(n => n.id === edge.source);
      if (promptNode && promptNode.data.cardType === 'story_master_prompt') {
        return promptNode.data.description ?? '';
      }
    }
    currentId = sourceNode.id;
  }

  return '';
};
