import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listImages, deleteImage } from '@root/image_server/generated-client';
import type { ImageName } from '@root/image_server/generated-client';
import { generateCharacter, regenerateCharacterPose, getBatchStatus } from '@root/image_gen/generated_client';
import type { BatchStatus, FailedItem } from '@root/image_gen/generated_client';
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

export type CharacterPose = {
  id: string;
  description: string;
  image?: string;
};

export type GenerationState = {
  batchId: string;
  status: 'generating' | 'done' | 'failed';
  completedCount?: number;
  totalCount?: number;
  files?: string[];
  errors?: FailedItem[];
  itemIds?: string[];
};

export type CardType = 'scene' | 'character' | 'master_prompt' | 'background';

export type SceneCharacter = {
  id: string;
  name: string;
};

export type CardNodeData = {
  label: string;
  image: string;
  cardType: CardType;
  description: string;
  outputs: SceneOutput[];
  poses?: CharacterPose[];
  characters?: SceneCharacter[];
  generation?: GenerationState;
  generatedImages?: string[];
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
    <div className={`nodrag nopan nowheel ${styles.imagePicker}`}>
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
  master_prompt: 'Мастер-промпт',
  background: 'Бэкграунд',
};

const useGenerationPolling = (nodeId: string, generation?: GenerationState) => {
  const { setGeneration, setGeneratedImages } = usePrototypeStore();

  useEffect(() => {
    if (!generation || generation.status !== 'generating') return;

    const interval = setInterval(async () => {
      try {
        const { data } = await getBatchStatus({
          path: { batchId: generation.batchId },
        });
        if (!data) return;
        const status = data as BatchStatus;
        const errors = status.failed.length > 0 ? status.failed : undefined;

        // Map completed items to correct indices using itemIds order
        let files: string[];
        if (generation.itemIds) {
          files = new Array(generation.itemIds.length).fill('');
          for (const c of status.completed) {
            const idx = generation.itemIds.indexOf(c.id);
            if (idx !== -1 && c.file) files[idx] = c.file;
          }
        } else {
          files = status.completed.map(c => c.file).filter(Boolean);
        }

        if (status.done) {
          setGeneration(nodeId, {
            ...generation,
            status: errors && !files.some(f => f) ? 'failed' : 'done',
            completedCount: status.completed.length,
            totalCount: status.total,
            files,
            errors,
          });
          if (files.some(f => f)) {
            setGeneratedImages(nodeId, files);
          }
        } else {
          setGeneration(nodeId, {
            ...generation,
            completedCount: status.completed.length,
            totalCount: status.total,
            files,
            errors,
          });
          if (files.some(f => f)) {
            setGeneratedImages(nodeId, files);
          }
        }
      } catch {
        clearInterval(interval);
        setGeneration(nodeId, {
          ...generation,
          status: 'failed',
          errors: [{ id: '', error: 'Сервер генерации недоступен' }],
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [nodeId, generation, setGeneration, setGeneratedImages]);
};

const getMasterPromptForNode = (nodeId: string, edges: CardEdge[], nodes: CardNode[]): string => {
  const incoming = edges.filter(e => e.target === nodeId);
  for (const edge of incoming) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode && sourceNode.data.cardType === 'master_prompt') {
      return sourceNode.data.description ?? '';
    }
  }
  return '';
};

const PoseInput = ({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}) => {
  const [focused, setFocused] = useState(false);

  if (focused) {
    return (
      <textarea
        autoFocus
        className={`nodrag nopan ${styles.poseTextarea}`}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setFocused(false)}
      />
    );
  }

  return (
    <div
      className={`nodrag nopan ${styles.poseCollapsed}`}
      onClick={() => setFocused(true)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter') setFocused(true);
      }}
    >
      {value || <span className={styles.posePlaceholder}>{placeholder}</span>}
    </div>
  );
};

const PosesSection = ({
  nodeId,
  poses,
  generatedImages,
  onRegeneratePose,
}: {
  nodeId: string;
  poses: CharacterPose[];
  generatedImages?: string[];
  onRegeneratePose?: (poseIndex: number, poseDescription: string) => Promise<void>;
}) => {
  const { addPose, removePose, updatePose } = usePrototypeStore();
  const [open, setOpen] = useState(true);
  const [deletingPoseId, setDeletingPoseId] = useState<string | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ image: string; x: number; y: number } | null>(null);

  const posesList = poses || [];

  const handleDeletePose = (poseId: string, poseIndex: number, poseImage?: string) => {
    if (poseImage) {
      deleteImage({ path: { name: poseImage } }).catch(() => {});
    }
    removePose(nodeId, poseId, poseIndex);
    setDeletingPoseId(null);
  };

  return (
    <div className={styles.posesSection}>
      <button className={`nodrag nopan ${styles.foldableHeader}`} onClick={() => setOpen(v => !v)} type="button">
        <span className={`${styles.foldableArrow} ${open ? styles.foldableArrowOpen : ''}`}>&#9654;</span>
        Позы ({posesList.length})
      </button>
      {open && (
        <div className={styles.posesList}>
          {posesList.map((pose, index) => {
            const poseImage = generatedImages?.[index];
            return (
              <div key={pose.id} className={styles.poseRow}>
                <div className={styles.poseContent}>
                  <PoseInput
                    value={pose.description}
                    placeholder="Описание позы (напр. грустный, боевая стойка)"
                    onChange={val => updatePose(nodeId, pose.id, val)}
                  />
                  <button
                    type="button"
                    className={`nodrag nopan ${styles.outputDelete}`}
                    onClick={() => {
                      if (!pose.description && !poseImage) {
                        handleDeletePose(pose.id, index, poseImage);
                      } else {
                        setDeletingPoseId(pose.id);
                      }
                    }}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
                {deletingPoseId === pose.id && (
                  <div className={`nodrag nopan ${styles.deleteConfirm}`}>
                    <p>Удалить позу?</p>
                    <div className={styles.deleteConfirmActions}>
                      <button
                        type="button"
                        className={styles.deleteConfirmCancel}
                        onClick={() => setDeletingPoseId(null)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className={styles.deleteConfirmSubmit}
                        onClick={() => handleDeletePose(pose.id, index, poseImage)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
                {poseImage ? (
                  <div
                    className={`${styles.poseThumbnailWrap} ${
                      regeneratingIndex === index ? styles.poseThumbnailRegenerating : ''
                    }`}
                  >
                    <img
                      src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(poseImage)}/thumbnail`}
                      alt={pose.description}
                      className={styles.poseThumbnail}
                      onMouseEnter={e => setHoverPreview({ image: poseImage, x: e.clientX, y: e.clientY })}
                      onMouseMove={e =>
                        setHoverPreview(prev => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
                      }
                      onMouseLeave={() => setHoverPreview(null)}
                    />
                    {onRegeneratePose && (
                      <button
                        type="button"
                        className={`nodrag nopan ${styles.poseRegenBtn} ${
                          regeneratingIndex === index ? styles.poseRegenSpinning : ''
                        }`}
                        title="Перегенерировать"
                        disabled={regeneratingIndex === index}
                        onClick={() => {
                          setRegeneratingIndex(index);
                          onRegeneratePose(index, pose.description).finally(() => setRegeneratingIndex(null));
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M1 8a7 7 0 0 1 12.07-4.83" />
                          <path d="M13.07 0v3.17H9.9" />
                          <path d="M15 8A7 7 0 0 1 2.93 12.83" />
                          <path d="M2.93 16v-3.17H6.1" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  onRegeneratePose && (
                    <button
                      type="button"
                      className={`nodrag nopan ${styles.poseGenerateBtn} ${
                        regeneratingIndex === index ? styles.poseGenerateBtnSpinning : ''
                      }`}
                      title="Сгенерировать позу"
                      disabled={regeneratingIndex === index}
                      onClick={() => {
                        setRegeneratingIndex(index);
                        onRegeneratePose(index, pose.description).finally(() => setRegeneratingIndex(null));
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="none">
                        <path d="M4.5 1l.5 1.5L6.5 3l-1.5.5L4.5 5l-.5-1.5L2.5 3l1.5-.5zM11 4l.7 2.3L14 7l-2.3.7L11 10l-.7-2.3L8 7l2.3-.7zM4.5 10l.5 1.5L6.5 12l-1.5.5-.5 1.5-.5-1.5L2.5 12l1.5-.5z" />
                      </svg>
                    </button>
                  )
                )}
              </div>
            );
          })}
          <button type="button" className={`nodrag nopan ${styles.addOutput}`} onClick={() => addPose(nodeId)}>
            + Добавить позу
          </button>
        </div>
      )}
      {hoverPreview &&
        createPortal(
          <div className={styles.posePreview} style={{ left: hoverPreview.x + 16, top: hoverPreview.y + 16 }}>
            <img src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(hoverPreview.image)}`} alt="Preview" />
          </div>,
          document.body,
        )}
    </div>
  );
};

const GenerationErrors = ({ errors }: { errors: FailedItem[] }) => (
  <div className={styles.generationErrors}>
    {errors.map(e => (
      <div key={e.id} className={styles.generationErrorItem}>
        <span className={styles.generationErrorId}>{e.id}:</span>{' '}
        <span className={styles.generationErrorMsg}>{e.error ?? 'неизвестная ошибка'}</span>
      </div>
    ))}
  </div>
);

const GenerationStatus = ({ generation }: { generation: GenerationState }) => {
  if (generation.status === 'generating') {
    const pct = generation.totalCount
      ? Math.round(((generation.completedCount ?? 0) / generation.totalCount) * 100)
      : 0;
    return (
      <div className={styles.generationStatus}>
        <div className={styles.loader} />
        <span className={styles.generationText}>Генерация… {pct}%</span>
        {generation.errors && <GenerationErrors errors={generation.errors} />}
      </div>
    );
  }
  if (generation.status === 'done') {
    return (
      <div className={styles.generationStatus}>
        <span className={styles.generationDone}>Готово</span>
        {generation.errors && <GenerationErrors errors={generation.errors} />}
      </div>
    );
  }
  if (generation.status === 'failed') {
    return (
      <div className={styles.generationStatus}>
        <span className={styles.generationFailed}>Ошибка</span>
        {generation.errors && <GenerationErrors errors={generation.errors} />}
      </div>
    );
  }
  return null;
};

const MasterPromptHandle = ({
  nodeId,
  edges,
  variant = 'character',
}: {
  nodeId: string;
  edges: CardEdge[];
  variant?: 'character' | 'background';
}) => (
  <div className={`${styles.masterPromptSection} ${variant === 'background' ? styles.masterPromptSectionBg : ''}`}>
    <Handle
      type="target"
      position={Position.Left}
      id="style"
      className={variant === 'background' ? styles.styleHandleBg : styles.styleHandle}
      isValidConnection={() => {
        const alreadyConnected = edges.some(e => e.target === nodeId && e.targetHandle === 'style');
        return !alreadyConnected;
      }}
    />
    <span className={`${styles.masterPromptLabel} ${variant === 'background' ? styles.masterPromptLabelBg : ''}`}>
      Мастер-промпт
    </span>
  </div>
);

const DescriptionTextarea = ({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => (
  <textarea
    className={`nodrag nopan ${styles.descriptionInput}`}
    placeholder={placeholder}
    value={value}
    onChange={e => onChange(e.target.value)}
  />
);

const GenerateControls = ({
  generation,
  onGenerate,
  disabled,
}: {
  generation?: GenerationState;
  onGenerate: () => void;
  disabled?: boolean;
}) => (
  <>
    {generation && <GenerationStatus generation={generation} />}
    <button
      type="button"
      className={`nodrag nopan ${styles.generateBtn}`}
      onClick={onGenerate}
      disabled={disabled || generation?.status === 'generating'}
    >
      {generation?.status === 'generating' ? 'Генерация…' : 'Сгенерировать'}
    </button>
  </>
);

const CharactersSection = ({ nodeId, characters }: { nodeId: string; characters: SceneCharacter[] }) => {
  const { addCharacter, removeCharacter, nodes } = usePrototypeStore();
  const [open, setOpen] = useState(false);

  const isValidCharConnection = useCallback(
    (connection: { source: string | null }) => {
      if (!connection.source) return false;
      const sourceNode = nodes.find(n => n.id === connection.source);
      return sourceNode?.data?.cardType === 'character';
    },
    [nodes],
  );

  return (
    <div className={styles.charactersSection}>
      <button
        className={`nodrag nopan ${styles.foldableHeader} ${styles.charactersFoldableHeader}`}
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        <span className={`${styles.foldableArrow} ${open ? styles.foldableArrowOpen : ''}`}>&#9654;</span>
        Персонажи ({characters.length})
        {!open &&
          characters.map(ch => (
            <Handle
              key={ch.id}
              type="target"
              id={`char-${ch.id}`}
              position={Position.Left}
              className={styles.characterHandle}
              isValidConnection={isValidCharConnection}
            />
          ))}
      </button>
      {open && (
        <div className={styles.charactersList}>
          {characters.map(ch => (
            <div key={ch.id} className={styles.characterRow}>
              <Handle
                type="target"
                id={`char-${ch.id}`}
                position={Position.Left}
                className={styles.characterHandle}
                isValidConnection={isValidCharConnection}
              />
              <input
                type="text"
                className={`nodrag nopan ${styles.outputInput}`}
                placeholder="Имя персонажа"
                value={ch.name}
                readOnly
              />
              <button
                type="button"
                className={`nodrag nopan ${styles.outputDelete}`}
                onClick={() => removeCharacter(nodeId, ch.id)}
                title="Удалить"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className={styles.charactersAdd}>
          <button type="button" className={`nodrag nopan ${styles.addOutput}`} onClick={() => addCharacter(nodeId)}>
            + Добавить персонажа
          </button>
        </div>
      )}
    </div>
  );
};

const CardNodeComponent = ({ id, data }: NodeProps<Node<CardNodeData>>) => {
  const store = usePrototypeStore();
  const { updateNodeData, addOutput, removeOutput, updateOutput, deleteNode, setGeneration } = store;
  const nodes = store.nodes;
  const edges = store.edges;
  const outputs = getOutputs(data);
  const [showPicker, setShowPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cardType = data.cardType ?? 'scene';

  useGenerationPolling(id, data.generation);

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
  const isMasterPrompt = cardType === 'master_prompt';
  const isBackground = cardType === 'background';

  const onGenerate = useCallback(async () => {
    const masterPrompt = getMasterPromptForNode(id, edges, nodes);
    const characterDescription = data.description ?? '';
    if (!characterDescription.trim()) return;

    // Ensure idle pose exists before generation
    const currentPoses = data.poses || [];
    const hasIdle = currentPoses.some(p => p.description.toLowerCase().trim() === 'idle');
    if (!hasIdle) {
      const idlePose: CharacterPose = { id: crypto.randomUUID(), description: 'idle' };
      store.updateNodeData(id, { poses: [idlePose, ...currentPoses] });
    }

    const posesForGen = hasIdle ? currentPoses : [{ id: '', description: 'idle' }, ...currentPoses];
    const poseDescriptions = posesForGen.map(p => p.description).filter(d => d.trim());

    try {
      const { data: respData } = await generateCharacter({
        body: {
          masterPrompt: masterPrompt || 'high quality digital art',
          characterDescription,
          poses: poseDescriptions.length > 0 ? poseDescriptions : undefined,
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
      setGeneration(id, {
        batchId: '',
        status: 'failed',
      });
    }
  }, [id, data.description, data.poses, edges, nodes, setGeneration, store]);

  const { updateGeneratedImage } = store;

  const onRegeneratePose = useCallback(
    (poseIndex: number, poseDescription: string): Promise<void> => {
      const masterPrompt = getMasterPromptForNode(id, edges, nodes);
      const characterDescription = data.description ?? '';
      if (!characterDescription.trim() || !poseDescription.trim()) return Promise.resolve();

      // Find existing idle image to use as reference
      const poses = data.poses || [];
      const idleIndex = poses.findIndex(p => p.description.toLowerCase().trim() === 'idle');
      const idleImage = idleIndex >= 0 ? data.generatedImages?.[idleIndex] : undefined;
      if (!idleImage) return Promise.resolve(); // Can't regenerate without idle reference

      const oldImage = data.generatedImages?.[poseIndex];
      const referenceImageUrl = `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(idleImage)}`;

      return regenerateCharacterPose({
        body: {
          masterPrompt: masterPrompt || 'high quality digital art',
          characterDescription,
          pose: poseDescription,
          referenceImageUrl,
        },
      })
        .then(({ data: respData }) => {
          if (!respData) return;
          const resp = respData as { batchId: string; itemIds: string[] };

          return new Promise<void>(resolve => {
            const poll = setInterval(async () => {
              try {
                const { data: statusData } = await getBatchStatus({
                  path: { batchId: resp.batchId },
                });
                if (!statusData) return;
                const status = statusData as BatchStatus;
                if (!status.done) return;

                clearInterval(poll);
                const poseId = poseDescription.toLowerCase().trim();
                const match = status.completed.find((c: { id: string; file: string }) => c.id === poseId);
                const file = match?.file;
                if (file) {
                  updateGeneratedImage(id, poseIndex, file);
                  if (oldImage) {
                    deleteImage({ path: { name: oldImage } }).catch(() => {});
                  }
                }
                resolve();
              } catch {
                clearInterval(poll);
                resolve();
              }
            }, 5000);
          });
        })
        .catch(() => {});
    },
    [id, data.description, data.generatedImages, data.poses, edges, nodes, updateGeneratedImage],
  );

  const onGenerateBackground = useCallback(async () => {
    const masterPrompt = getMasterPromptForNode(id, edges, nodes);
    const backgroundDescription = data.description ?? '';
    if (!backgroundDescription.trim()) return;

    try {
      const { data: respData } = await generateCharacter({
        body: {
          masterPrompt: masterPrompt || 'high quality digital art',
          characterDescription: backgroundDescription,
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
      setGeneration(id, {
        batchId: '',
        status: 'failed',
      });
    }
  }, [id, data.description, edges, nodes, setGeneration]);

  const cardClass = isCharacter
    ? styles.characterCard
    : isMasterPrompt
    ? styles.masterPromptCard
    : isBackground
    ? styles.backgroundCard
    : '';

  return (
    <>
      {!isCharacter && !isMasterPrompt && !isBackground && <Handle type="target" position={Position.Top} />}
      {isMasterPrompt && <Handle type="source" position={Position.Right} id="prompt_out" />}
      {isCharacter && <Handle type="source" position={Position.Right} id="char_out" className={styles.charOutHandle} />}
      {isBackground && <Handle type="source" position={Position.Right} id="bg_out" className={styles.bgOutHandle} />}
      <div className={`${styles.sceneCard} ${cardClass}`}>
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
        {!isMasterPrompt && !isBackground && (
          <>
            <div
              className={`nodrag nopan ${styles.sceneImage} ${styles.sceneImageClickable}`}
              onClick={() => setShowPicker(v => !v)}
            >
              {data.image ? <img src={data.image} alt="" /> : <span>Выбрать изображение</span>}
            </div>
            {showPicker && <ImagePicker onSelect={onSelectImage} onClose={() => setShowPicker(false)} />}
          </>
        )}
        {isMasterPrompt ? (
          <DescriptionTextarea
            value={data.description ?? ''}
            placeholder="Мастер-промпт (стиль, качество)"
            onChange={val => updateNodeData(id, { description: val })}
          />
        ) : isCharacter ? (
          <>
            <MasterPromptHandle nodeId={id} edges={edges} />
            <DescriptionTextarea
              value={data.description ?? ''}
              placeholder="Описание персонажа"
              onChange={val => updateNodeData(id, { description: val })}
            />
            <PosesSection
              nodeId={id}
              poses={data.poses || []}
              generatedImages={data.generatedImages}
              onRegeneratePose={onRegeneratePose}
            />
            <GenerateControls generation={data.generation} onGenerate={onGenerate} />
          </>
        ) : isBackground ? (
          <>
            <MasterPromptHandle nodeId={id} edges={edges} variant="background" />
            <DescriptionTextarea
              value={data.description ?? ''}
              placeholder="Описание бэкграунда"
              onChange={val => updateNodeData(id, { description: val })}
            />
            {data.generatedImages?.[0] && (
              <div className={styles.bgImagePreview}>
                <img
                  src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(data.generatedImages[0])}/thumbnail`}
                  alt="Бэкграунд"
                />
              </div>
            )}
            <GenerateControls generation={data.generation} onGenerate={onGenerateBackground} />
          </>
        ) : (
          <>
            <CharactersSection nodeId={id} characters={data.characters || []} />
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
          </>
        )}
      </div>
    </>
  );
};

const nodeTypes = {
  scene: CardNodeComponent,
  character: CardNodeComponent,
  master_prompt: CardNodeComponent,
  background: CardNodeComponent,
};

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
  const [pendingReplace, setPendingReplace] = useState<{
    connection: Parameters<OnConnect>[0];
    existingEdgeId: string;
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
          // Already connected to same source — ignore
          if (existing.source === connection.source) return;
          // Different source — ask user to replace
          setPendingReplace({ connection, existingEdgeId: existing.id });
          return;
        }
      }

      setEdges(eds => addEdge(connection, eds as Edge[]).map(toCardEdge));
    },
    [setEdges, edges],
  );

  const onConfirmReplace = useCallback(() => {
    if (!pendingReplace) return;
    setEdges(eds => {
      const filtered = eds.filter(e => e.id !== pendingReplace.existingEdgeId);
      return addEdge(pendingReplace.connection, filtered as Edge[]).map(toCardEdge);
    });
    setPendingReplace(null);
  }, [pendingReplace, setEdges]);

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
              <p>К этому слоту уже подключён персонаж. Заменить?</p>
              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.deleteConfirmCancel} onClick={onCancelReplace}>
                  Отмена
                </button>
                <button type="button" className={`${styles.deleteConfirmSubmit}`} onClick={onConfirmReplace}>
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
              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.deleteConfirmCancel} onClick={onCancelDeleteEdge}>
                  Отмена
                </button>
                <button type="button" className={styles.deleteConfirmSubmit} onClick={onConfirmDeleteEdge}>
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
