import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listImages } from '@root/image_server/generated-client';
import type { ImageName } from '@root/image_server/generated-client';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  MarkerType,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import type { Node, Edge, OnConnect, DefaultEdgeOptions } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styles from './main.module.css';

export type SceneOutput = {
  id: string;
  text: string;
};

export type SceneNodeData = {
  label: string;
  image: string;
  outputs: SceneOutput[];
};

const getOutputs = (data: SceneNodeData & { text?: string }): SceneOutput[] => {
  if (data.outputs) return data.outputs;
  if ('text' in data && data.text !== undefined) {
    return [{ id: 'out_1', text: data.text }];
  }
  return [];
};

type FlowContextValue = {
  updateNodeData: (nodeId: string, data: Partial<SceneNodeData>) => void;
  addOutput: (nodeId: string) => void;
  removeOutput: (nodeId: string, outputId: string) => void;
  updateOutput: (nodeId: string, outputId: string, text: string) => void;
};

const FlowContext = createContext<FlowContextValue | null>(null);

const SceneNode = ({ id, data }: NodeProps<Node<SceneNodeData>>) => {
  const ctx = useContext(FlowContext);
  const outputs = getOutputs(data);

  const onImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      ctx?.updateNodeData(id, { image: e.target.value });
    },
    [id, ctx],
  );

  const onOutputChange = useCallback(
    (outputId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      ctx?.updateOutput(id, outputId, e.target.value);
    },
    [id, ctx],
  );

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className={styles.sceneCard}>
        <div className={styles.sceneImage}>
          {data.image ? <img src={data.image} alt="" /> : <span>Изображение</span>}
        </div>
        <input
          type="url"
          className={`nodrag nopan ${styles.sceneImageInput}`}
          placeholder="URL изображения"
          value={data.image}
          onChange={onImageChange}
        />
        <div className={styles.outputsBlock}>
          {outputs.map(output => (
            <div key={output.id} className={styles.outputRow}>
              <input
                type="text"
                className={`nodrag nopan ${styles.outputInput}`}
                placeholder="Текст выхода"
                value={output.text}
                onChange={e => onOutputChange(output.id, e)}
              />
              <Handle type="source" id={output.id} position={Position.Right} className={styles.outputHandle} />
              <button
                type="button"
                className={`nodrag nopan ${styles.outputDelete}`}
                onClick={() => ctx?.removeOutput(id, output.id)}
                title="Удалить"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className={`nodrag nopan ${styles.addOutput}`} onClick={() => ctx?.addOutput(id)}>
            + Добавить выход
          </button>
        </div>
      </div>
    </>
  );
};

const nodeTypes = { scene: SceneNode };

let nextId = 0;
let nextOutputId = 0;

const IMAGE_SERVER_BASE = 'http://localhost:3007';

const ImageGallery = () => {
  const [images, setImages] = useState<ImageName[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listImages();
      if (data) setImages(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return (
    <div className={styles.foldableSection}>
      <button
        className={styles.foldableHeader}
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        <span className={`${styles.foldableArrow} ${open ? styles.foldableArrowOpen : ''}`}>&#9654;</span>
        Изображения
      </button>
      {open && (
        <div className={styles.imageList}>
          {loading && <span className={styles.imageListHint}>Загрузка…</span>}
          {!loading && images.length === 0 && (
            <span className={styles.imageListHint}>Нет изображений</span>
          )}
          {images.map(img => (
            <div key={img.name} className={styles.imageItem} title={img.name}>
              <img
                src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(img.name)}/thumbnail`}
                alt={img.name}
                className={styles.imageThumb}
              />
              <span className={styles.imageName}>{img.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SceneNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [addMode, setAddMode] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  const defaultEdgeOptions: DefaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    }),
    [],
  );

  const onConnect: OnConnect = useCallback(connection => setEdges(eds => addEdge(connection, eds)), [setEdges]);

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!addMode) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = `scene_${++nextId}`;
      const newNode: Node<SceneNodeData> = {
        id,
        type: 'scene',
        position,
        data: {
          label: `Сцена ${nextId}`,
          image: '',
          outputs: [{ id: `out_${++nextOutputId}`, text: '' }],
        },
      };

      setNodes(nds => [...nds, newNode]);
    },
    [addMode, screenToFlowPosition, setNodes],
  );

  const onExport = useCallback(() => {
    const state = { nodes, edges };
    const json = JSON.stringify(state, null, 2);
    console.log(json);
  }, [nodes, edges]);

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<SceneNodeData>) => {
      setNodes(nds => nds.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)));
    },
    [setNodes],
  );

  const addOutput = useCallback(
    (nodeId: string) => {
      const newOutput: SceneOutput = { id: `out_${++nextOutputId}`, text: '' };
      setNodes(nds =>
        nds.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, outputs: [...(n.data.outputs || []), newOutput] } } : n,
        ),
      );
    },
    [setNodes],
  );

  const removeOutput = useCallback(
    (nodeId: string, outputId: string) => {
      setNodes(nds =>
        nds.map(n =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, outputs: (n.data.outputs || []).filter(o => o.id !== outputId) } }
            : n,
        ),
      );
      setEdges(eds => eds.filter(e => !(e.source === nodeId && e.sourceHandle === outputId)));
    },
    [setNodes, setEdges],
  );

  const updateOutput = useCallback(
    (nodeId: string, outputId: string, text: string) => {
      setNodes(nds =>
        nds.map(n =>
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
      );
    },
    [setNodes],
  );

  const flowContext = useMemo(
    () => ({ updateNodeData, addOutput, removeOutput, updateOutput }),
    [updateNodeData, addOutput, removeOutput, updateOutput],
  );

  return (
    <FlowContext.Provider value={flowContext}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={defaultEdgeOptions}
        className={addMode ? styles.addMode : undefined}
      >
        <Background />
        <Panel position="top-left" className={styles.sidePanel}>
          <button
            className={`${styles.toolButton} ${addMode ? styles.active : ''}`}
            onClick={() => setAddMode(v => !v)}
          >
            + Добавить сцену
          </button>
          <button className={styles.toolButton} onClick={onExport}>
            Экспорт в JSON
          </button>
          <ImageGallery />
        </Panel>
      </ReactFlow>
    </FlowContext.Provider>
  );
};

const Main = () => {
  return (
    <div className={styles.container}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
};

export default Main;
