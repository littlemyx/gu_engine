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

export const getMasterPromptForNode = (nodeId: string, edges: CardEdge[], nodes: CardNode[]): string => {
  const incoming = edges.filter(e => e.target === nodeId);
  for (const edge of incoming) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode && sourceNode.data.cardType === 'master_prompt') {
      return sourceNode.data.description ?? '';
    }
  }
  return '';
};
