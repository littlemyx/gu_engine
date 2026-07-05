import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { generateMelody } from '@root/audio_gen/generated_client';
import type { BatchCreated } from '@root/audio_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import { AUDIO_SERVER_BASE } from '../constants';
import type { CardNodeData } from '../types';
import { useAudioBatchPolling } from '../hooks/useAudioGenerationPolling';
import { DescriptionTextarea } from './DescriptionTextarea';
import { GenerateControls } from './GenerateControls';
import { MiniAudioPlayer } from './MiniAudioPlayer';
import styles from './AudioMasterPromptCardBody.module.css';

export const AudioMasterPromptCardBody = ({ id, data }: { id: string; data: CardNodeData }) => {
  const { updateNodeData, setAudioGeneration, setGeneratedAudio, setAudioSelected } = usePrototypeStore();

  useAudioBatchPolling(data.audioGeneration, {
    onUpdate: g => setAudioGeneration(id, g),
    onFiles: f => setGeneratedAudio(id, f),
  });

  const onGenerate = useCallback(async () => {
    const style = data.description ?? '';
    if (!style.trim()) return;

    try {
      const { data: respData } = await generateMelody({
        body: { style, instrumental: true },
      });
      if (respData) {
        const resp = respData as BatchCreated;
        setAudioGeneration(id, {
          batchId: resp.batchId,
          status: 'generating',
          completedCount: 0,
          totalCount: resp.itemIds.length,
          itemIds: resp.itemIds,
        });
      }
    } catch {
      setAudioGeneration(id, { batchId: '', status: 'failed' });
    }
  }, [id, data.description, setAudioGeneration]);

  const audioFiles = data.generatedAudio ?? [];
  const selectedBase = data.audioSelected?.base ?? 0;

  return (
    <div className={styles.body}>
      <Handle type="source" position={Position.Right} id="audio_prompt_out" />
      <DescriptionTextarea
        value={data.description ?? ''}
        placeholder="Стиль аудио (жанр, инструменты, настроение)"
        onChange={val => updateNodeData(id, { description: val })}
      />
      {audioFiles.some(Boolean) && (
        <div className={styles.audioResults}>
          {audioFiles.map((file, i) =>
            file ? (
              <div key={file} className={styles.variantRow}>
                <input
                  type="radio"
                  className="nodrag nopan"
                  name={`base-variant-${id}`}
                  checked={selectedBase === i}
                  onChange={() => setAudioSelected(id, 'base', i)}
                  title="Использовать как базовую мелодию"
                />
                <MiniAudioPlayer
                  src={`${AUDIO_SERVER_BASE}/audio/${encodeURIComponent(file)}`}
                  label={`Вариант ${i + 1}`}
                />
              </div>
            ) : null,
          )}
        </div>
      )}
      <GenerateControls generation={data.audioGeneration} onGenerate={onGenerate} />
    </div>
  );
};
