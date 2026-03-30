import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { generateCharacter, regenerateCharacterPose, getBatchStatus } from '@root/image_gen/generated_client';
import type { BatchStatus } from '@root/image_gen/generated_client';
import { deleteImage } from '@root/image_server/generated-client';
import { usePrototypeStore } from '@/store/prototypeStore';
import { IMAGE_SERVER_BASE } from '../constants';
import { getMasterPromptForNode } from '../utils';
import type { CardNodeData, CharacterPose } from '../types';
import { useGenerationPolling } from '../hooks/useGenerationPolling';
import { MasterPromptHandle } from './MasterPromptHandle';
import { DescriptionTextarea } from './DescriptionTextarea';
import { PosesSection } from './PosesSection';
import { GenerateControls } from './GenerateControls';
import styles from './CharacterCardBody.module.css';

export const CharacterCardBody = ({ id, data }: { id: string; data: CardNodeData }) => {
  const store = usePrototypeStore();
  const { updateNodeData, setGeneration, updateGeneratedImage } = store;
  const nodes = store.nodes;
  const edges = store.edges;

  useGenerationPolling(id, data.generation);

  const onGenerate = useCallback(async () => {
    const masterPrompt = getMasterPromptForNode(id, edges, nodes);
    const characterDescription = data.description ?? '';
    if (!characterDescription.trim()) return;

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
      setGeneration(id, { batchId: '', status: 'failed' });
    }
  }, [id, data.description, data.poses, edges, nodes, setGeneration, store]);

  const onRegeneratePose = useCallback(
    (poseIndex: number, poseDescription: string): Promise<void> => {
      const masterPrompt = getMasterPromptForNode(id, edges, nodes);
      const characterDescription = data.description ?? '';
      if (!characterDescription.trim() || !poseDescription.trim()) return Promise.resolve();

      const poses = data.poses || [];
      const idleIndex = poses.findIndex(p => p.description.toLowerCase().trim() === 'idle');
      const idleImage = idleIndex >= 0 ? data.generatedImages?.[idleIndex] : undefined;
      if (!idleImage) return Promise.resolve();

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

  return (
    <div className={styles.body}>
      <Handle type="source" position={Position.Right} id="char_out" className={styles.charOutHandle} />
      <MasterPromptHandle nodeId={id} edges={edges} />
      <input
        className={`nodrag nopan ${styles.nameInput}`}
        type="text"
        placeholder="Имя персонажа"
        value={data.name ?? ''}
        onChange={e => updateNodeData(id, { name: e.target.value })}
      />
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
    </div>
  );
};
