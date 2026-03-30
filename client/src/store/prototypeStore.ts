import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CardNode,
  CardEdge,
  CardNodeData,
  SceneOutput,
  SceneCharacter,
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
  duplicateNode: (nodeId: string) => void;
  changeNodeType: (nodeId: string, newType: CardNodeData['cardType']) => void;

  addCharacter: (nodeId: string) => void;
  removeCharacter: (nodeId: string, characterId: string) => void;

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

      duplicateNode: nodeId => {
        set(s => {
          const original = s.nodes.find(n => n.id === nodeId);
          if (!original) return s;

          const newId = crypto.randomUUID();

          const outputIdMap = new Map<string, string>();
          const newOutputs = (original.data.outputs || []).map(o => {
            const newOutputId = crypto.randomUUID();
            outputIdMap.set(o.id, newOutputId);
            return { ...o, id: newOutputId };
          });

          const characterIdMap = new Map<string, string>();
          const newCharacters = (original.data.characters || []).map(c => {
            const newCharId = crypto.randomUUID();
            characterIdMap.set(c.id, newCharId);
            return { ...c, id: newCharId };
          });

          const newPoses = (original.data.poses || []).map(p => ({ ...p, id: crypto.randomUUID() }));

          const newNode: CardNode = {
            id: newId,
            type: original.type,
            position: { x: original.position.x + 300, y: original.position.y },
            data: {
              ...original.data,
              outputs: newOutputs,
              characters: newCharacters.length > 0 ? newCharacters : original.data.characters,
              poses: newPoses.length > 0 ? newPoses : original.data.poses,
            },
          };

          const incomingEdges = s.edges.filter(e => e.target === nodeId && e.targetHandle !== 'scene_in');
          const newEdges = incomingEdges.map(e => {
            let targetHandle = e.targetHandle;
            if (targetHandle) {
              const charMatch = targetHandle.match(/^char-(.+)$/);
              if (charMatch && characterIdMap.has(charMatch[1])) {
                targetHandle = `char-${characterIdMap.get(charMatch[1])}`;
              }
            }
            return {
              ...e,
              id: crypto.randomUUID(),
              target: newId,
              targetHandle,
            };
          });

          return {
            nodes: [...s.nodes, newNode],
            edges: [...s.edges, ...newEdges],
          };
        });
      },

      changeNodeType: (nodeId, newType) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  type: newType,
                  data: {
                    label: '',
                    image: '',
                    cardType: newType,
                    description: '',
                    outputs: newType === 'scene' ? [{ id: crypto.randomUUID(), text: '' }] : [],
                  },
                }
              : n,
          ),
          edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        }));
      },

      addCharacter: nodeId => {
        const newCharacter: SceneCharacter = { id: crypto.randomUUID(), name: '' };
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, characters: [...(n.data.characters || []), newCharacter] } }
              : n,
          ),
        }));
      },

      removeCharacter: (nodeId, characterId) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, characters: (n.data.characters || []).filter(c => c.id !== characterId) } }
              : n,
          ),
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
