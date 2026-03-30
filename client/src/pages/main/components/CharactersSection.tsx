import { useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { usePrototypeStore } from '@/store/prototypeStore';
import { IMAGE_SERVER_BASE } from '../constants';
import type { CardNodeData, SceneCharacter } from '../types';
import common from '../common.module.css';
import styles from './CharactersSection.module.css';

const getConnectedCharacterData = (
  nodeId: string,
  characterId: string,
  edges: { source: string; target: string; targetHandle?: string | null }[],
  nodes: { id: string; data: CardNodeData }[],
): { name: string; idleImage?: string } | undefined => {
  const charEdge = edges.find(e => e.target === nodeId && e.targetHandle === `char-${characterId}`);
  if (!charEdge) return undefined;
  const charNode = nodes.find(n => n.id === charEdge.source);
  if (!charNode) return undefined;

  const name = charNode.data.name || '';
  const poses = charNode.data.poses || [];
  const idleIndex = poses.findIndex(p => p.description.toLowerCase().trim() === 'idle');
  const idleFile = idleIndex >= 0 ? charNode.data.generatedImages?.[idleIndex] : undefined;
  const idleImage = idleFile ? `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(idleFile)}` : undefined;

  return { name, idleImage };
};

export const CharactersSection = ({ nodeId, characters }: { nodeId: string; characters: SceneCharacter[] }) => {
  const { addCharacter, removeCharacter, nodes, edges } = usePrototypeStore();
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
        className={`nodrag nopan ${common.foldableHeader} ${styles.charactersFoldableHeader}`}
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        <span className={`${common.foldableArrow} ${open ? common.foldableArrowOpen : ''}`}>&#9654;</span>
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
          {characters.map(ch => {
            const connected = getConnectedCharacterData(nodeId, ch.id, edges, nodes);
            const displayName = connected?.name || 'Имя персонажа';
            const isPlaceholder = !connected?.name;

            return (
              <div key={ch.id} className={styles.characterRow}>
                <Handle
                  type="target"
                  id={`char-${ch.id}`}
                  position={Position.Left}
                  className={styles.characterHandle}
                  isValidConnection={isValidCharConnection}
                />
                <div className={styles.characterPreview}>
                  {connected?.idleImage ? (
                    <img src={connected.idleImage} alt="" className={styles.characterThumb} />
                  ) : (
                    <div className={styles.characterThumbEmpty} />
                  )}
                </div>
                <span className={`${styles.characterName} ${isPlaceholder ? styles.characterNamePlaceholder : ''}`}>
                  {displayName}
                </span>
                <button
                  type="button"
                  className={`nodrag nopan ${common.outputDelete}`}
                  onClick={() => removeCharacter(nodeId, ch.id)}
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
      {open && (
        <div className={styles.charactersAdd}>
          <button type="button" className={`nodrag nopan ${common.addOutput}`} onClick={() => addCharacter(nodeId)}>
            + Добавить персонажа
          </button>
        </div>
      )}
    </div>
  );
};
