import React, { useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { usePrototypeStore } from '@/store/prototypeStore';
import { IMAGE_SERVER_BASE } from '../constants';
import type { CardNodeData } from '../types';
import { getOutputs } from '../utils';
import { ImagePicker } from './ImagePicker';
import { CharactersSection } from './CharactersSection';
import common from '../common.module.css';
import styles from './SceneCardBody.module.css';

const getConnectedBgImage = (
  nodeId: string,
  edges: { source: string; target: string; targetHandle?: string | null }[],
  nodes: { id: string; data: CardNodeData }[],
): string | undefined => {
  const bgEdge = edges.find(e => e.target === nodeId && e.targetHandle === 'bg');
  if (!bgEdge) return undefined;
  const bgNode = nodes.find(n => n.id === bgEdge.source);
  const file = bgNode?.data.generatedImages?.[0];
  return file ? `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(file)}` : undefined;
};

export const SceneCardBody = ({ id, data }: { id: string; data: CardNodeData }) => {
  const store = usePrototypeStore();
  const { updateNodeData, addOutput, removeOutput, updateOutput, setEdges, duplicateNode } = store;
  const nodes = store.nodes;
  const edges = store.edges;
  const outputs = getOutputs(data);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingManualImage, setPendingManualImage] = useState<string | null>(null);

  const bgEdge = edges.find(e => e.target === id && e.targetHandle === 'bg');
  const connectedBgImage = getConnectedBgImage(id, edges, nodes);
  const displayImage = connectedBgImage || data.image;

  const isValidBgConnection = useCallback(
    (connection: { source: string | null }) => {
      if (!connection.source) return false;
      const sourceNode = nodes.find(n => n.id === connection.source);
      return sourceNode?.data?.cardType === 'background';
    },
    [nodes],
  );

  const onSelectImage = useCallback(
    (url: string) => {
      if (bgEdge) {
        // Background connected — ask to replace
        setPendingManualImage(url);
        setShowPicker(false);
      } else {
        updateNodeData(id, { image: url });
        setShowPicker(false);
      }
    },
    [id, updateNodeData, bgEdge],
  );

  const onConfirmManualImage = useCallback(() => {
    if (!pendingManualImage || !bgEdge) return;
    // Disconnect background and set manual image
    setEdges(eds => eds.filter(e => e.id !== bgEdge.id));
    updateNodeData(id, { image: pendingManualImage });
    setPendingManualImage(null);
  }, [id, pendingManualImage, bgEdge, setEdges, updateNodeData]);

  const onCancelManualImage = useCallback(() => {
    setPendingManualImage(null);
  }, []);

  const onOutputChange = useCallback(
    (outputId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      updateOutput(id, outputId, e.target.value);
    },
    [id, updateOutput],
  );

  return (
    <>
      <div className={styles.imageArea}>
        <Handle
          type="target"
          id="bg"
          position={Position.Left}
          className={styles.bgHandle}
          isValidConnection={isValidBgConnection}
        />
        <div
          className={`nodrag nopan ${styles.sceneImage} ${styles.sceneImageClickable}`}
          onClick={() => setShowPicker(v => !v)}
        >
          {displayImage ? <img src={displayImage} alt="" /> : <span>Выбрать изображение</span>}
        </div>
        {displayImage && (
          <button
            type="button"
            className={`nodrag nopan ${styles.clearImageBtn}`}
            title="Очистить картинку"
            onClick={() => {
              if (bgEdge) {
                setEdges(eds => eds.filter(e => e.id !== bgEdge.id));
              }
              updateNodeData(id, { image: '' });
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
            </svg>
          </button>
        )}
      </div>
      {showPicker && <ImagePicker onSelect={onSelectImage} onClose={() => setShowPicker(false)} />}
      {pendingManualImage && (
        <div className={`nodrag nopan ${common.deleteConfirm}`}>
          <p>Отключить бэкграунд и использовать выбранную картинку?</p>
          <div className={common.deleteConfirmActions}>
            <button type="button" className={common.deleteConfirmCancel} onClick={onCancelManualImage}>
              Отмена
            </button>
            <button type="button" className={common.deleteConfirmSubmit} onClick={onConfirmManualImage}>
              Заменить
            </button>
          </div>
        </div>
      )}
      <CharactersSection nodeId={id} characters={data.characters || []} />
      <textarea
        className={`nodrag nopan ${styles.sceneText}`}
        placeholder="Текст сцены..."
        value={data.sceneText || ''}
        onChange={e => updateNodeData(id, { sceneText: e.target.value })}
      />
      <div className={styles.outputsBlock}>
        {outputs.map(output => (
          <div key={output.id} className={styles.outputRow}>
            <input
              type="text"
              className={`nodrag nopan ${common.outputInput}`}
              placeholder="Текст выхода"
              value={output.text}
              onChange={e => onOutputChange(output.id, e)}
            />
            <Handle type="source" id={output.id} position={Position.Right} className={styles.outputHandle} />
            <button
              type="button"
              className={`nodrag nopan ${common.outputDelete}`}
              onClick={() => removeOutput(id, output.id)}
              title="Удалить"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className={`nodrag nopan ${common.addOutput}`} onClick={() => addOutput(id)}>
          + Добавить выход
        </button>
      </div>
      <button
        type="button"
        className={`nodrag nopan ${styles.duplicateBtn}`}
        onClick={() => duplicateNode(id)}
      >
        Дублировать
      </button>
    </>
  );
};
