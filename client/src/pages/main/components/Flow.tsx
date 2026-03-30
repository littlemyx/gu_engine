import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow, Background, Panel, useReactFlow, addEdge, applyEdgeChanges, MarkerType } from '@xyflow/react';
import type { Node, Edge, OnConnect, OnNodesChange, OnEdgesChange, DefaultEdgeOptions } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@alenaksu/json-viewer';
import type { JsonViewer } from '@alenaksu/json-viewer/dist/JsonViewer';
import { usePrototypeStore } from '@/store/prototypeStore';
import { toCardEdge } from '../utils';
import type { CardNode, CardNodeData } from '../types';
import styles from '../main.module.css';
import common from '../common.module.css';
import { CardShell } from './CardShell';
import { ImageGallery } from './ImageGallery';
import { NewProjectDialog } from './NewProjectDialog';

const nodeTypes = {
  scene: CardShell,
  character: CardShell,
  master_prompt: CardShell,
  background: CardShell,
};

export const Flow = () => {
  const { nodes, edges, setNodes, setEdges, deleteNode, updateNodeData, loadScenes, reset } = usePrototypeStore();
  const [addMode, setAddMode] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [pendingReplace, setPendingReplace] = useState<{
    connection: Parameters<OnConnect>[0];
    existingEdgeId?: string;
    clearManualImage?: string; // nodeId whose data.image should be cleared
    message: string;
  } | null>(null);
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
          setNodes(nds => nds.map(n => (n.id === change.id ? { ...n, position: { x, y } } : n)));
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
      interactionWidth: 20,
    }),
    [],
  );

  const [pendingDeleteEdge, setPendingDeleteEdge] = useState<string | null>(null);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setPendingDeleteEdge(edge.id);
  }, []);

  const onConfirmDeleteEdge = useCallback(() => {
    if (!pendingDeleteEdge) return;
    setEdges(eds => eds.filter(e => e.id !== pendingDeleteEdge));
    setPendingDeleteEdge(null);
  }, [pendingDeleteEdge, setEdges]);

  const onCancelDeleteEdge = useCallback(() => {
    setPendingDeleteEdge(null);
  }, []);

  const onConnect: OnConnect = useCallback(
    connection => {
      if (connection.targetHandle === 'style') {
        const alreadyConnected = edges.some(e => e.target === connection.target && e.targetHandle === 'style');
        if (alreadyConnected) return;
      }

      // Character handle: only one connection allowed per handle
      if (connection.targetHandle?.startsWith('char-')) {
        const existing = edges.find(e => e.target === connection.target && e.targetHandle === connection.targetHandle);
        if (existing) {
          if (existing.source === connection.source) return;
          setPendingReplace({
            connection,
            existingEdgeId: existing.id,
            message: 'К этому слоту уже подключён персонаж. Заменить?',
          });
          return;
        }
      }

      // Background handle: only one bg connection per scene, conflicts with manual image
      if (connection.targetHandle === 'bg') {
        const existingBg = edges.find(e => e.target === connection.target && e.targetHandle === 'bg');
        if (existingBg) {
          if (existingBg.source === connection.source) return;
          setPendingReplace({
            connection,
            existingEdgeId: existingBg.id,
            message: 'К сцене уже подключён бэкграунд. Заменить?',
          });
          return;
        }
        // Check if scene has a manual image set
        const targetNode = nodes.find(n => n.id === connection.target);
        if (targetNode?.data.image) {
          setPendingReplace({
            connection,
            clearManualImage: connection.target!,
            message: 'У сцены уже выбрана картинка. Заменить на бэкграунд?',
          });
          return;
        }
      }

      setEdges(eds => addEdge(connection, eds as Edge[]).map(toCardEdge));
    },
    [setEdges, edges, nodes],
  );

  const onConfirmReplace = useCallback(() => {
    if (!pendingReplace) return;
    if (pendingReplace.clearManualImage) {
      updateNodeData(pendingReplace.clearManualImage, { image: '' });
    }
    setEdges(eds => {
      const filtered = pendingReplace.existingEdgeId ? eds.filter(e => e.id !== pendingReplace.existingEdgeId) : eds;
      return addEdge(pendingReplace.connection, filtered as Edge[]).map(toCardEdge);
    });
    setPendingReplace(null);
  }, [pendingReplace, setEdges, updateNodeData]);

  const onCancelReplace = useCallback(() => {
    setPendingReplace(null);
  }, []);

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
        onEdgeClick={onEdgeClick}
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
      {pendingReplace &&
        createPortal(
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <p>{pendingReplace.message}</p>
              <div className={common.deleteConfirmActions}>
                <button type="button" className={common.deleteConfirmCancel} onClick={onCancelReplace}>
                  Отмена
                </button>
                <button type="button" className={common.deleteConfirmSubmit} onClick={onConfirmReplace}>
                  Заменить
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {pendingDeleteEdge &&
        createPortal(
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <p>Удалить соединение?</p>
              <div className={common.deleteConfirmActions}>
                <button type="button" className={common.deleteConfirmCancel} onClick={onCancelDeleteEdge}>
                  Отмена
                </button>
                <button type="button" className={common.deleteConfirmSubmit} onClick={onConfirmDeleteEdge}>
                  Удалить
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
