import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardNode, CardEdge, CardNodeData, SceneOutput } from '../pages/main/index';

type PrototypeState = {
  nodes: CardNode[];
  edges: CardEdge[];

  setNodes: (nodes: CardNode[] | ((prev: CardNode[]) => CardNode[])) => void;
  setEdges: (edges: CardEdge[] | ((prev: CardEdge[]) => CardEdge[])) => void;

  updateNodeData: (nodeId: string, data: Partial<CardNodeData>) => void;
  addOutput: (nodeId: string) => void;
  removeOutput: (nodeId: string, outputId: string) => void;
  updateOutput: (nodeId: string, outputId: string, text: string) => void;
  deleteNode: (nodeId: string) => void;

  loadScenes: (nodes: CardNode[], edges: CardEdge[]) => void;
  reset: () => void;
};

export const usePrototypeStore = create<PrototypeState>()(
  persist(
    (set) => ({
      nodes: [],
      edges: [],

      setNodes: updater => {
        set(s => ({
          nodes: typeof updater === 'function' ? updater(s.nodes) : updater,
        }));
      },

      setEdges: updater => {
        set(s => ({
          edges: typeof updater === 'function' ? updater(s.edges) : updater,
        }));
      },

      updateNodeData: (nodeId, data) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? { ...n, ...(data.cardType ? { type: data.cardType } : {}), data: { ...n.data, ...data } }
              : n,
          ),
        }));
      },

      addOutput: (nodeId) => {
        const newOutput: SceneOutput = { id: crypto.randomUUID(), text: '' };
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, outputs: [...(n.data.outputs || []), newOutput] } }
              : n,
          ),
        }));
      },

      removeOutput: (nodeId, outputId) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, outputs: (n.data.outputs || []).filter(o => o.id !== outputId) } }
              : n,
          ),
          edges: s.edges.filter(e => !(e.source === nodeId && e.sourceHandle === outputId)),
        }));
      },

      updateOutput: (nodeId, outputId, text) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: (n.data.outputs || []).map(o => (o.id === outputId ? { ...o, text } : o)),
                  },
                }
              : n,
          ),
        }));
      },

      deleteNode: (nodeId) => {
        set(s => ({
          nodes: s.nodes.filter(n => n.id !== nodeId),
          edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        }));
      },

      loadScenes: (nodes, edges) => {
        set({ nodes, edges });
      },

      reset: () => {
        set({ nodes: [], edges: [] });
      },
    }),
    {
      name: 'gu-prototype',
    },
  ),
);
