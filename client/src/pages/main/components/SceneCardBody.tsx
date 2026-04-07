import React, { useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { generateSceneText } from '@root/text_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import { IMAGE_SERVER_BASE } from '../constants';
import type { CardNodeData } from '../types';
import { getOutputs, getSceneContext, getMaxDepthFromNode, getStoryMasterPromptForNode } from '../utils';
import { useSceneTextPolling } from '../hooks/useSceneTextPolling';
import { ImagePicker } from './ImagePicker';
import { CharactersSection } from './CharactersSection';
import { GenerateControls } from './GenerateControls';
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
  const { updateNodeData, addOutput, removeOutput, updateOutput, setEdges, duplicateNode, setGeneration } = store;
  const nodes = store.nodes;
  const edges = store.edges;
  const outputs = getOutputs(data);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingManualImage, setPendingManualImage] = useState<string | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  useSceneTextPolling(id, data.generation);

  const onGenerateScene = useCallback(async () => {
    const cardEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    const cardNodes = nodes.map(n => ({
      id: n.id,
      type: n.data.cardType,
      position: n.position,
      data: n.data,
    }));

    const ctx = getSceneContext(id, cardEdges, cardNodes);
    const maxDepth = getMaxDepthFromNode(id, cardEdges, cardNodes);
    const storyMasterPrompt = getStoryMasterPromptForNode(id, cardEdges, cardNodes);

    const characters = (data.characters || [])
      .map(ch => {
        const charEdge = cardEdges.find(e => e.target === id && e.targetHandle === `char-${ch.id}`);
        if (!charEdge) return null;
        const charNode = cardNodes.find(n => n.id === charEdge.source);
        if (!charNode || charNode.data.cardType !== 'character') return null;
        return {
          name: charNode.data.name || '',
          description: charNode.data.description || undefined,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null && c.name !== '');

    try {
      const { data: respData } = await generateSceneText({
        body: {
          storyMasterPrompt: storyMasterPrompt || '',
          sceneChain: ctx.chain,
          depth: ctx.depth,
          maxDepth,
          incomingOutputText: ctx.incomingOutputText,
          characters: characters.length > 0 ? characters : undefined,
        },
      });
      if (respData) {
        const resp = respData as { batchId: string; itemIds: string[] };
        setGeneration(id, {
          batchId: resp.batchId,
          status: 'generating',
          completedCount: 0,
          totalCount: resp.itemIds.length,
          itemIds: resp.itemIds,
        });
      }
    } catch {
      setGeneration(id, { batchId: '', status: 'failed' });
    }
  }, [id, edges, nodes, setGeneration]);

  const hasSceneContent = !!(data.sceneText || (data.outputs?.length && data.outputs.some(o => o.text)));

  const onRequestGenerate = useCallback(() => {
    if (hasSceneContent) {
      setShowGenerateConfirm(true);
    } else {
      onGenerateScene();
    }
  }, [hasSceneContent, onGenerateScene]);

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
        className={`nodrag nopan nowheel ${styles.sceneText}`}
        placeholder="Текст сцены..."
        value={data.sceneText || ''}
        onChange={e => updateNodeData(id, { sceneText: e.target.value })}
      />
      <GenerateControls generation={data.generation} onGenerate={onRequestGenerate} />
      {showGenerateConfirm && (
        <div className={`nodrag nopan ${common.deleteConfirm}`}>
          <p>Сцена уже содержит данные. Перегенерировать?</p>
          <div className={common.deleteConfirmActions}>
            <button type="button" className={common.deleteConfirmCancel} onClick={() => setShowGenerateConfirm(false)}>
              Отмена
            </button>
            <button
              type="button"
              className={common.deleteConfirmSubmit}
              onClick={() => {
                setShowGenerateConfirm(false);
                onGenerateScene();
              }}
            >
              Перегенерировать
            </button>
          </div>
        </div>
      )}
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
