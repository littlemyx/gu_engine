import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';
import type { SceneNodeData } from '../pages/main/index';

type PrototypeState = {
  nodes: Node<SceneNodeData>[];
  edges: Edge[];
  nextNodeId: number;
  nextOutputId: number;

  setNodes: (nodes: Node<SceneNodeData>[] | ((prev: Node<SceneNodeData>[]) => Node<SceneNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  bumpNodeId: () => number;
  bumpOutputId: () => number;
  reset: () => void;
};

export const usePrototypeStore = create<PrototypeState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      nextNodeId: 0,
      nextOutputId: 0,

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

      bumpNodeId: () => {
        const id = get().nextNodeId + 1;
        set({ nextNodeId: id });
        return id;
      },

      bumpOutputId: () => {
        const id = get().nextOutputId + 1;
        set({ nextOutputId: id });
        return id;
      },

      reset: () => {
        set({ nodes: [], edges: [], nextNodeId: 0, nextOutputId: 0 });
      },
    }),
    {
      name: 'gu-prototype',
    },
  ),
);
