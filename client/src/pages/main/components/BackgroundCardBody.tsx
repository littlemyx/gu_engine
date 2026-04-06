import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from '@xyflow/react';
import { generateBackground } from '@root/image_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import { IMAGE_SERVER_BASE } from '../constants';
import { getVisualMasterPromptForNode, getStoryMasterPromptForNode } from '../utils';
import type { CardNodeData } from '../types';
import { useGenerationPolling } from '../hooks/useGenerationPolling';
import { MasterPromptHandle } from './MasterPromptHandle';
import { DescriptionTextarea } from './DescriptionTextarea';
import { GenerateControls } from './GenerateControls';
import styles from './BackgroundCardBody.module.css';

export const BackgroundCardBody = ({ id, data }: { id: string; data: CardNodeData }) => {
  const store = usePrototypeStore();
  const { updateNodeData, setGeneration } = store;
  const nodes = store.nodes;
  const edges = store.edges;

  const [hoverPreview, setHoverPreview] = useState<{ x: number; y: number } | null>(null);

  useGenerationPolling(id, data.generation);

  const bgImage = data.generatedImages?.[0];

  const onGenerate = useCallback(async () => {
    const masterPrompt = getVisualMasterPromptForNode(id, edges, nodes);
    const storyMasterPrompt = getStoryMasterPromptForNode(id, edges, nodes);
    const backgroundDescription = data.description ?? '';
    if (!backgroundDescription.trim()) return;

    try {
      const { data: respData } = await generateBackground({
        body: {
          masterPrompt: masterPrompt || 'high quality digital art',
          storyMasterPrompt: storyMasterPrompt || undefined,
          sceneDescription: backgroundDescription,
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
  }, [id, data.description, edges, nodes, setGeneration]);

  return (
    <div className={styles.body}>
      <Handle type="source" position={Position.Right} id="bg_out" className={styles.bgOutHandle} />
      <MasterPromptHandle nodeId={id} edges={edges} variant="background" />
      <input
        className={`nodrag nopan ${styles.nameInput}`}
        type="text"
        placeholder="Имя задника"
        value={data.name ?? ''}
        onChange={e => updateNodeData(id, { name: e.target.value })}
      />
      <DescriptionTextarea
        value={data.description ?? ''}
        placeholder="Описание бэкграунда"
        onChange={val => updateNodeData(id, { description: val })}
      />
      {bgImage && (
        <div className={styles.bgImagePreview}>
          <img
            src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(bgImage)}/thumbnail`}
            alt="Бэкграунд"
            onMouseEnter={e => setHoverPreview({ x: e.clientX, y: e.clientY })}
            onMouseMove={e => setHoverPreview({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHoverPreview(null)}
          />
        </div>
      )}
      {hoverPreview &&
        bgImage &&
        createPortal(
          <div className={styles.imagePreview} style={{ left: hoverPreview.x + 16, top: hoverPreview.y + 16 }}>
            <img src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(bgImage)}`} alt="Preview" />
          </div>,
          document.body,
        )}
      <GenerateControls generation={data.generation} onGenerate={onGenerate} />
    </div>
  );
};
