import { useState, useCallback } from 'react';
import { generateVariation } from '@root/audio_gen/generated_client';
import type { BatchCreated } from '@root/audio_gen/generated_client';
import { usePrototypeStore } from '@/store/prototypeStore';
import { AUDIO_SERVER_BASE } from '../constants';
import { getAudioMasterPromptForNode } from '../utils';
import type { CardNodeData, CardEdge, CardNode, AudioTone, GenerationState } from '../types';
import { useAudioBatchPolling } from '../hooks/useAudioGenerationPolling';
import { GenerationStatus } from './GenerationStatus';
import { MiniAudioPlayer } from './MiniAudioPlayer';
import common from '../common.module.css';
import styles from './AudioCharacterSection.module.css';

const TONE_LABELS: Record<AudioTone, string> = {
  positive: 'Позитивный тон',
  negative: 'Негативный тон',
};

const TONE_PLACEHOLDERS: Record<AudioTone, string> = {
  positive: 'Тёплый, мажорный, с мягкими струнными',
  negative: 'Тёмный, минорный, напряжённые струнные',
};

const ToneBlock = ({
  nodeId,
  tone,
  toneText,
  generation,
  variations,
  selectedIndex,
  baseMelody,
  onToneTextChange,
  onGenerate,
  onSelect,
}: {
  nodeId: string;
  tone: AudioTone;
  toneText: string;
  generation?: GenerationState;
  variations?: string[];
  selectedIndex: number;
  baseMelody?: string;
  onToneTextChange: (val: string) => void;
  onGenerate: () => void;
  onSelect: (index: number) => void;
}) => {
  const isGenerating = generation?.status === 'generating';
  return (
    <div className={styles.toneBlock}>
      <label className={styles.toneLabel}>
        <span className={styles.toneLabelText}>{TONE_LABELS[tone]}</span>
        <textarea
          className={`nodrag nopan ${common.descriptionInput}`}
          placeholder={TONE_PLACEHOLDERS[tone]}
          value={toneText}
          onChange={e => onToneTextChange(e.target.value)}
        />
      </label>
      {variations?.some(Boolean) && (
        <div className={styles.audioResults}>
          {variations.map((file, i) =>
            file ? (
              <div key={file} className={styles.variantRow}>
                <input
                  type="radio"
                  className="nodrag nopan"
                  name={`${tone}-variant-${nodeId}`}
                  checked={selectedIndex === i}
                  onChange={() => onSelect(i)}
                  title="Использовать эту вариацию"
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
      {generation && <GenerationStatus generation={generation} />}
      <button
        type="button"
        className={`nodrag nopan ${styles.toneGenBtn}`}
        onClick={onGenerate}
        disabled={!baseMelody || isGenerating || !toneText.trim()}
      >
        {isGenerating ? 'Генерация…' : 'Сгенерировать'}
      </button>
    </div>
  );
};

export const AudioCharacterSection = ({
  nodeId,
  data,
  edges,
  nodes,
}: {
  nodeId: string;
  data: CardNodeData;
  edges: CardEdge[];
  nodes: CardNode[];
}) => {
  const { updateNodeData, setAudioToneGeneration, setAudioVariations, setAudioSelected } = usePrototypeStore();
  const [open, setOpen] = useState(false);

  useAudioBatchPolling(data.audioGenerationByTone?.positive, {
    onUpdate: g => setAudioToneGeneration(nodeId, 'positive', g),
    onFiles: f => setAudioVariations(nodeId, 'positive', f),
  });
  useAudioBatchPolling(data.audioGenerationByTone?.negative, {
    onUpdate: g => setAudioToneGeneration(nodeId, 'negative', g),
    onFiles: f => setAudioVariations(nodeId, 'negative', f),
  });

  const audioMasterNode = getAudioMasterPromptForNode(nodeId, edges, nodes);
  const baseFiles = audioMasterNode?.data.generatedAudio ?? [];
  const baseMelody = baseFiles[audioMasterNode?.data.audioSelected?.base ?? 0] || baseFiles.find(Boolean);

  const onGenerateVariation = useCallback(
    async (tone: AudioTone) => {
      if (!baseMelody) return;
      const toneText = tone === 'positive' ? data.audioPositiveTone : data.audioNegativeTone;
      if (!toneText?.trim()) return;

      try {
        const { data: respData } = await generateVariation({
          body: { baseAudioName: baseMelody, toneStyle: toneText, variationType: tone },
        });
        if (respData) {
          const resp = respData as BatchCreated;
          setAudioToneGeneration(nodeId, tone, {
            batchId: resp.batchId,
            status: 'generating',
            completedCount: 0,
            totalCount: resp.itemIds.length,
            itemIds: resp.itemIds,
          });
        }
      } catch {
        setAudioToneGeneration(nodeId, tone, { batchId: '', status: 'failed' });
      }
    },
    [nodeId, baseMelody, data.audioPositiveTone, data.audioNegativeTone, setAudioToneGeneration],
  );

  return (
    <div className={styles.section}>
      <button className={`nodrag nopan ${common.foldableHeader}`} onClick={() => setOpen(v => !v)} type="button">
        <span className={`${common.foldableArrow} ${open ? common.foldableArrowOpen : ''}`}>&#9654;</span>
        Звуковой характер
      </button>
      {open && (
        <div className={styles.content}>
          {!baseMelody && <div className={styles.noBaseWarning}>Подключите аудио мастер-промпт с готовой мелодией</div>}
          <ToneBlock
            nodeId={nodeId}
            tone="positive"
            toneText={data.audioPositiveTone ?? ''}
            generation={data.audioGenerationByTone?.positive}
            variations={data.audioVariations?.positive}
            selectedIndex={data.audioSelected?.positive ?? 0}
            baseMelody={baseMelody}
            onToneTextChange={val => updateNodeData(nodeId, { audioPositiveTone: val })}
            onGenerate={() => onGenerateVariation('positive')}
            onSelect={i => setAudioSelected(nodeId, 'positive', i)}
          />
          <ToneBlock
            nodeId={nodeId}
            tone="negative"
            toneText={data.audioNegativeTone ?? ''}
            generation={data.audioGenerationByTone?.negative}
            variations={data.audioVariations?.negative}
            selectedIndex={data.audioSelected?.negative ?? 0}
            baseMelody={baseMelody}
            onToneTextChange={val => updateNodeData(nodeId, { audioNegativeTone: val })}
            onGenerate={() => onGenerateVariation('negative')}
            onSelect={i => setAudioSelected(nodeId, 'negative', i)}
          />
        </div>
      )}
    </div>
  );
};
