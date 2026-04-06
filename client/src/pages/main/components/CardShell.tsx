import React, { useCallback, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { usePrototypeStore } from '@/store/prototypeStore';
import { CARD_TYPE_LABELS } from '../constants';
import type { CardNodeData, CardType } from '../types';
import { SceneCardBody } from './SceneCardBody';
import { CharacterCardBody } from './CharacterCardBody';
import { BackgroundCardBody } from './BackgroundCardBody';
import { VisualMasterPromptCardBody } from './VisualMasterPromptCardBody';
import { StoryMasterPromptCardBody } from './StoryMasterPromptCardBody';
import common from '../common.module.css';
import styles from './CardShell.module.css';

export const CardShell = ({ id, data }: NodeProps<Node<CardNodeData>>) => {
  const { updateNodeData, deleteNode, changeNodeType, edges } = usePrototypeStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingType, setPendingType] = useState<CardType | null>(null);
  const cardType = data.cardType ?? 'scene';

  const hasContent =
    !!data.label ||
    !!data.image ||
    !!data.name ||
    !!data.description ||
    (data.outputs ?? []).some(o => o.text) ||
    (data.poses ?? []).length > 0 ||
    (data.characters ?? []).length > 0 ||
    (data.generatedImages ?? []).length > 0 ||
    !!data.generation;

  const hasConnections = edges.some(e => e.source === id || e.target === id);

  const onCardTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as CardType;
      if (hasContent || hasConnections) {
        setPendingType(newType);
      } else {
        updateNodeData(id, { cardType: newType });
      }
    },
    [id, updateNodeData, hasContent, hasConnections],
  );

  const isCharacter = cardType === 'character';
  const isVisualMasterPrompt = cardType === 'visual_master_prompt';
  const isStoryMasterPrompt = cardType === 'story_master_prompt';
  const isMasterPrompt = isVisualMasterPrompt || isStoryMasterPrompt;
  const isBackground = cardType === 'background';
  const isScene = !isCharacter && !isMasterPrompt && !isBackground;

  return (
    <>
      {isScene && <Handle type="target" id="scene_in" position={Position.Top} />}
      <div className={styles.card}>
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
          <div className={`nodrag nopan ${common.deleteConfirm}`}>
            <p>Удалить карточку?</p>
            <div className={common.deleteConfirmActions}>
              <button type="button" className={common.deleteConfirmCancel} onClick={() => setShowDeleteConfirm(false)}>
                Отмена
              </button>
              <button type="button" className={common.deleteConfirmSubmit} onClick={() => deleteNode(id)}>
                Удалить
              </button>
            </div>
          </div>
        )}
        {pendingType && (
          <div className={`nodrag nopan ${common.deleteConfirm}`}>
            <p>Сменить тип карточки? Все содержимое и соединения будут удалены.</p>
            <div className={common.deleteConfirmActions}>
              <button type="button" className={common.deleteConfirmCancel} onClick={() => setPendingType(null)}>
                Отмена
              </button>
              <button
                type="button"
                className={common.deleteConfirmSubmit}
                onClick={() => {
                  changeNodeType(id, pendingType);
                  setPendingType(null);
                }}
              >
                Сменить
              </button>
            </div>
          </div>
        )}
        {isScene && <SceneCardBody id={id} data={data} />}
        {isCharacter && <CharacterCardBody id={id} data={data} />}
        {isBackground && <BackgroundCardBody id={id} data={data} />}
        {isVisualMasterPrompt && <VisualMasterPromptCardBody id={id} data={data} />}
        {isStoryMasterPrompt && <StoryMasterPromptCardBody id={id} data={data} />}
      </div>
    </>
  );
};
