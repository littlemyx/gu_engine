import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CardNode,
  CardEdge,
  CardNodeData,
  SceneOutput,
  CharacterPose,
  GenerationState,
} from '../pages/main/index';

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

  addPose: (nodeId: string) => void;
  removePose: (nodeId: string, poseId: string, poseIndex: number) => void;
  updatePose: (nodeId: string, poseId: string, description: string) => void;
  setGeneration: (nodeId: string, generation: GenerationState | undefined) => void;
  setGeneratedImages: (nodeId: string, images: string[]) => void;
  updateGeneratedImage: (nodeId: string, index: number, image: string) => void;

  loadScenes: (nodes: CardNode[], edges: CardEdge[]) => void;
  reset: () => void;
};

export const usePrototypeStore = create<PrototypeState>()(
  persist(
    set => ({
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

      addOutput: nodeId => {
        const newOutput: SceneOutput = { id: crypto.randomUUID(), text: '' };
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId ? { ...n, data: { ...n.data, outputs: [...(n.data.outputs || []), newOutput] } } : n,
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

      deleteNode: nodeId => {
        set(s => ({
          nodes: s.nodes.filter(n => n.id !== nodeId),
          edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        }));
      },

      addPose: nodeId => {
        const newPose: CharacterPose = { id: crypto.randomUUID(), description: '' };
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId ? { ...n, data: { ...n.data, poses: [...(n.data.poses || []), newPose] } } : n,
          ),
        }));
      },

      removePose: (nodeId, poseId, poseIndex) => {
        set(s => ({
          nodes: s.nodes.map(n => {
            if (n.id !== nodeId) return n;
            const poses = (n.data.poses || []).filter(p => p.id !== poseId);
            const generatedImages = n.data.generatedImages
              ? n.data.generatedImages.filter((_, i) => i !== poseIndex)
              : undefined;
            return { ...n, data: { ...n.data, poses, generatedImages } };
          }),
        }));
      },

      updatePose: (nodeId, poseId, description) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    poses: (n.data.poses || []).map(p => (p.id === poseId ? { ...p, description } : p)),
                  },
                }
              : n,
          ),
        }));
      },

      setGeneration: (nodeId, generation) => {
        set(s => ({
          nodes: s.nodes.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, generation } } : n)),
        }));
      },

      setGeneratedImages: (nodeId, images) => {
        set(s => ({
          nodes: s.nodes.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, generatedImages: images } } : n)),
        }));
      },

      updateGeneratedImage: (nodeId, index, image) => {
        set(s => ({
          nodes: s.nodes.map(n => {
            if (n.id !== nodeId) return n;
            const imgs = [...(n.data.generatedImages || [])];
            imgs[index] = image;
            return { ...n, data: { ...n.data, generatedImages: imgs } };
          }),
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
