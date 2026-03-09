import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listImages } from '@root/image_server/generated-client';
import type { ImageName } from '@root/image_server/generated-client';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Panel,
  useReactFlow,
  addEdge,
  applyEdgeChanges,
  MarkerType,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import type { Node, Edge, OnConnect, OnNodesChange, OnEdgesChange, DefaultEdgeOptions } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@alenaksu/json-viewer';
import type { JsonViewer } from '@alenaksu/json-viewer/dist/JsonViewer';
import styles from './main.module.css';
import { usePrototypeStore } from '../../store/prototypeStore';

export type SceneOutput = {
  id: string;
  text: string;
};

export type CardType = 'scene' | 'character';

export type CardNodeData = {
  label: string;
  image: string;
  cardType: CardType;
  description: string;
  outputs: SceneOutput[];
};

export type CardNode = {
  id: string;
  type: CardType;
  position: { x: number; y: number };
  data: CardNodeData;
};

export type CardEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type ExportData = {
  nodes: CardNode[];
  edges: CardEdge[];
};

const getOutputs = (data: CardNodeData & { text?: string }): SceneOutput[] => {
  if (data.outputs) return data.outputs;
  if ('text' in data && data.text !== undefined) {
    return [{ id: 'out_1', text: data.text }];
  }
  return [];
};

const IMAGE_SERVER_BASE = 'http://localhost:3007';

const toCardEdge = ({ id, source, target, sourceHandle, targetHandle }: Edge): CardEdge => ({
  id,
  source,
  target,
  ...(sourceHandle != null ? { sourceHandle } : {}),
  ...(targetHandle != null ? { targetHandle } : {}),
});

const ImagePicker = ({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) => {
  const [images, setImages] = useState<ImageName[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listImages().then(({ data }) => {
      if (data) setImages(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className={`nodrag nopan ${styles.imagePicker}`}>
      <div className={styles.imagePickerHeader}>
        <span>Выберите изображение</span>
        <button type="button" className={styles.imagePickerClose} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.imagePickerGrid}>
        {loading && <span className={styles.imageListHint}>Загрузка…</span>}
        {!loading && images.length === 0 && <span className={styles.imageListHint}>Нет изображений</span>}
        {images.map(img => (
          <button
            key={img.name}
            type="button"
            className={styles.imagePickerItem}
            onClick={() => onSelect(`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(img.name)}`)}
            title={img.name}
          >
            <img src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(img.name)}/thumbnail`} alt={img.name} />
          </button>
        ))}
      </div>
    </div>
  );
};

const CARD_TYPE_LABELS: Record<CardType, string> = {
  scene: 'Сцена',
  character: 'Персонаж',
};

const CardNode = ({ id, data }: NodeProps<Node<CardNodeData>>) => {
  const { updateNodeData, addOutput, removeOutput, updateOutput, deleteNode } = usePrototypeStore();
  const outputs = getOutputs(data);
  const [showPicker, setShowPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cardType = data.cardType ?? 'scene';

  const onSelectImage = useCallback(
    (url: string) => {
      updateNodeData(id, { image: url });
      setShowPicker(false);
    },
    [id, updateNodeData],
  );

  const onCardTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { cardType: e.target.value as CardType });
    },
    [id, updateNodeData],
  );

  const onOutputChange = useCallback(
    (outputId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      updateOutput(id, outputId, e.target.value);
    },
    [id, updateOutput],
  );

  const isCharacter = cardType === 'character';

  return (
    <>
      {!isCharacter && <Handle type="target" position={Position.Top} />}
      <div className={`${styles.sceneCard} ${isCharacter ? styles.characterCard : ''}`}>
        <div className={styles.cardHeader}>
          <select className={`nodrag nopan ${styles.cardTypeSelect}`} value={cardType} onChange={onCardTypeChange}>
            {(Object.keys(CARD_TYPE_LABELS) as CardType[]).map(t => (
              <option key={t} value={t}>
                {CARD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`nodrag nopan ${styles.nodeDeleteBtn}`}
            onClick={() => setShowDeleteConfirm(true)}
            title="Удалить карточку"
          >
            ×
          </button>
        </div>
        {showDeleteConfirm && (
          <div className={`nodrag nopan ${styles.deleteConfirm}`}>
            <p>Удалить карточку?</p>
            <div className={styles.deleteConfirmActions}>
              <button type="button" className={styles.deleteConfirmCancel} onClick={() => setShowDeleteConfirm(false)}>
                Отмена
              </button>
              <button type="button" className={styles.deleteConfirmSubmit} onClick={() => deleteNode(id)}>
                Удалить
              </button>
            </div>
          </div>
        )}
        <div
          className={`nodrag nopan ${styles.sceneImage} ${styles.sceneImageClickable}`}
          onClick={() => setShowPicker(v => !v)}
        >
          {data.image ? <img src={data.image} alt="" /> : <span>Выбрать изображение</span>}
        </div>
        {showPicker && <ImagePicker onSelect={onSelectImage} onClose={() => setShowPicker(false)} />}
        {isCharacter ? (
          <textarea
            className={`nodrag nopan ${styles.descriptionInput}`}
            placeholder="Описание персонажа"
            value={data.description ?? ''}
            onChange={e => updateNodeData(id, { description: e.target.value })}
          />
        ) : (
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
                  onClick={() => removeOutput(id, output.id)}
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className={`nodrag nopan ${styles.addOutput}`} onClick={() => addOutput(id)}>
              + Добавить выход
            </button>
          </div>
        )}
      </div>
    </>
  );
};

const nodeTypes = { scene: CardNode, character: CardNode };

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
      <button className={styles.foldableHeader} onClick={() => setOpen(v => !v)} type="button">
        <span className={`${styles.foldableArrow} ${open ? styles.foldableArrowOpen : ''}`}>&#9654;</span>
        Изображения
      </button>
      {open && (
        <div className={styles.imageList}>
          {loading && <span className={styles.imageListHint}>Загрузка…</span>}
          {!loading && images.length === 0 && <span className={styles.imageListHint}>Нет изображений</span>}
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

const NewProjectDialog = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onCancel}>
      <form method="dialog" className={styles.dialogContent}>
        <p className={styles.dialogText}>Создать новый проект? Текущий прототип будет очищен.</p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.toolButton} onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className={`${styles.toolButton} ${styles.danger}`} onClick={onConfirm}>
            Создать
          </button>
        </div>
      </form>
    </dialog>
  );
};

const Flow = () => {
  const { nodes, edges, setNodes, setEdges, deleteNode, loadScenes, reset } = usePrototypeStore();
  const [addMode, setAddMode] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonViewerRef = useCallback(
    (el: JsonViewer | null) => {
      if (el) el.data = { nodes, edges };
    },
    [nodes, edges],
  );
  const { screenToFlowPosition } = useReactFlow();

  const rfNodes = nodes as Node<CardNodeData>[];
  const rfEdges = edges as Edge[];

  const onNodesChange: OnNodesChange = useCallback(
    changes => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const { x, y } = change.position;
          setNodes(nds =>
            nds.map(n => (n.id === change.id ? { ...n, position: { x, y } } : n)),
          );
        } else if (change.type === 'remove') {
          deleteNode(change.id);
        }
      }
    },
    [setNodes, deleteNode],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    changes => setEdges(eds => applyEdgeChanges(changes, eds as Edge[]).map(toCardEdge)),
    [setEdges],
  );

  const defaultEdgeOptions: DefaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    }),
    [],
  );

  const onConnect: OnConnect = useCallback(
    connection => setEdges(eds => addEdge(connection, eds as Edge[]).map(toCardEdge)),
    [setEdges],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!addMode) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = crypto.randomUUID();
      const newNode: CardNode = {
        id,
        type: 'scene',
        position: { x: position.x, y: position.y },
        data: {
          label: '',
          image: '',
          cardType: 'scene',
          description: '',
          outputs: [{ id: crypto.randomUUID(), text: '' }],
        },
      };

      setNodes(nds => [...nds, newNode]);
    },
    [addMode, screenToFlowPosition, setNodes],
  );

  const onExport = useCallback(() => {
    const scenes = JSON.stringify({ nodes, edges }, null, 2);
    const scenesBlob = new Blob([scenes], { type: 'application/json' });
    const scenesUrl = URL.createObjectURL(scenesBlob);
    const scenesLink = document.createElement('a');
    scenesLink.href = scenesUrl;
    scenesLink.download = 'scenes.json';
    scenesLink.click();
    URL.revokeObjectURL(scenesUrl);

    const project = JSON.stringify({ title: 'Новелла', scenes: './scenes.json', settings: {} }, null, 2);
    const projectBlob = new Blob([project], { type: 'application/json' });
    const projectUrl = URL.createObjectURL(projectBlob);
    const projectLink = document.createElement('a');
    projectLink.href = projectUrl;
    projectLink.download = 'project.gu.json';
    projectLink.click();
    URL.revokeObjectURL(projectUrl);
  }, [nodes, edges]);

  const handleNewProject = useCallback(() => {
    reset();
    setShowNewDialog(false);
  }, [reset]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.nodes && data.edges) {
            loadScenes(data.nodes, data.edges);
          }
        } catch {
          alert('Не удалось прочитать файл');
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [loadScenes],
  );

  return (
    <>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={defaultEdgeOptions}
        className={addMode ? styles.addMode : undefined}
      >
        <Background />
        <Panel position="top-left" className={`${styles.sidePanel} ${leftPanelOpen ? '' : styles.panelCollapsed}`}>
          <button
            type="button"
            className={styles.panelToggle}
            onClick={() => setLeftPanelOpen(v => !v)}
            title={leftPanelOpen ? 'Свернуть' : 'Развернуть'}
          >
            <span className={`${styles.panelToggleArrow} ${leftPanelOpen ? '' : styles.panelToggleArrowCollapsed}`}>
              &#9664;
            </span>
          </button>
          {leftPanelOpen && (
            <>
              <button className={styles.toolButton} onClick={() => setShowNewDialog(true)}>
                Новый проект
              </button>
              <button className={styles.toolButton} onClick={() => fileInputRef.current?.click()}>
                Открыть файл
              </button>
              <input ref={fileInputRef} type="file" accept=".json" hidden onChange={handleImport} />
              <button
                className={`${styles.toolButton} ${addMode ? styles.active : ''}`}
                onClick={() => setAddMode(v => !v)}
              >
                + Добавить
              </button>
              <ImageGallery />
            </>
          )}
        </Panel>
        <Panel position="top-right" className={`${styles.rightPanel} ${rightPanelOpen ? '' : styles.panelCollapsed}`}>
          <button
            type="button"
            className={styles.panelToggle}
            onClick={() => setRightPanelOpen(v => !v)}
            title={rightPanelOpen ? 'Свернуть' : 'Развернуть'}
          >
            <span
              className={`${styles.panelToggleArrow} ${rightPanelOpen ? '' : styles.panelToggleArrowCollapsedRight}`}
            >
              &#9654;
            </span>
          </button>
          {rightPanelOpen && (
            <>
              <button className={styles.toolButton} onClick={onExport}>
                Экспорт в JSON
              </button>
              {/* @ts-expect-error json-viewer is a web component */}
              <json-viewer ref={jsonViewerRef} class={styles.jsonPreview} />
            </>
          )}
        </Panel>
      </ReactFlow>
      {showNewDialog && <NewProjectDialog onConfirm={handleNewProject} onCancel={() => setShowNewDialog(false)} />}
    </>
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
