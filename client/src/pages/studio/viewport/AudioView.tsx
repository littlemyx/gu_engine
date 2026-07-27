import React from 'react';

import { audioUrlFor } from '@/narrative';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { MiniAudioPlayer } from '@/pages/main/components/MiniAudioPlayer';

import styles from './viewport.module.css';

import type { AudioModel, AudioRowStatus, AudioTrackRow } from '../derive/audioModel';
import type { AudioTrackState } from '@/narrative/narrativeStore';

/** Буквенные метки вариантов Suno: в банке их два на трек. */
const VARIANT_LETTERS = ['A', 'B', 'C', 'D'];

const STATUS_CLASS: Record<AudioRowStatus, string> = {
  done: '',
  generating: 'audioStatusWait',
  failed: 'audioStatusBad',
  missing: 'audioStatusWait',
  unused: 'audioStatusMuted',
};

/** Переключатель A/B + превью выбранного варианта готового трека. */
const TrackVariants = ({ track, onSelect }: { track: AudioTrackState | null; onSelect: (index: number) => void }) => {
  if (track?.status !== 'done') return null;
  const selectedFile = track.filenames[track.selected] || track.filenames.find(Boolean);
  const url = audioUrlFor(selectedFile);
  return (
    <span className={styles.audioVariants}>
      {track.filenames.map((file, i) =>
        file ? (
          <button
            key={file}
            type="button"
            className={`${styles.audioVariantBtn} ${track.selected === i ? styles.audioVariantActive : ''}`}
            title={`вариант ${VARIANT_LETTERS[i] ?? i + 1} — уходит в бандл`}
            onClick={() => onSelect(i)}
          >
            {VARIANT_LETTERS[i] ?? String(i + 1)}
          </button>
        ) : null,
      )}
      {url && <MiniAudioPlayer src={url} />}
    </span>
  );
};

const BankRow = ({ row, onSelect }: { row: AudioTrackRow; onSelect: (index: number) => void }) => (
  <React.Fragment>
    <span className={row.status === 'unused' ? styles.audioRowMuted : styles.audioRowLabel}>{row.label}</span>
    <span className={styles.audioRowMono}>{row.mono}</span>
    <span className={`${styles.audioRowStatus} ${styles[STATUS_CLASS[row.status]] ?? ''}`}>
      {row.status === 'done' ? <TrackVariants track={row.track} onSelect={onSelect} /> : row.statusText}
    </span>
  </React.Fragment>
);

export interface AudioViewProps {
  model: AudioModel;
  /** Стиль подложки, который уйдёт в генерацию (правится в инспекторе). */
  baseStyle: string;
}

/**
 * Вкладка «Аудио» (макет 7a): банк треков проекта — базовая подложка,
 * эмбиенты по настроениям, диегетика особых локаций, вариации тепло/холод
 * на персонажа и SFX-набор. Запуск конвейера живёт в инспекторе.
 */
const AudioView = ({ model, baseStyle }: AudioViewProps) => {
  const selectAudioBase = useNarrativeStore(s => s.selectAudioBase);
  const selectAudioMoodBed = useNarrativeStore(s => s.selectAudioMoodBed);
  const selectAudioSpecialBed = useNarrativeStore(s => s.selectAudioSpecialBed);
  const selectAudioVariation = useNarrativeStore(s => s.selectAudioVariation);

  return (
    <div className={styles.audioRoot}>
      <div className={styles.audioColumn}>
        <section className={styles.audioPanel}>
          <header className={styles.audioPanelHead}>
            <span>Базовая подложка</span>
            <span className={styles.audioPanelTag}>bgm · GenerateMelodyRequest</span>
          </header>
          <div className={styles.audioPrompt}>
            <span className={styles.audioPromptText}>{baseStyle}</span>
            <span className={styles.audioInstrumental}>☑ instrumental</span>
          </div>
          {model.base.status === 'done' ? (
            <div className={styles.audioBaseVariants}>
              {model.base.track?.status === 'done' &&
                model.base.track.filenames.map((file, i) => {
                  const url = audioUrlFor(file);
                  const selected = model.base.track?.status === 'done' && model.base.track.selected === i;
                  return url ? (
                    <label
                      key={file}
                      className={`${styles.audioBaseVariant} ${selected ? styles.audioBaseVariantActive : ''}`}
                    >
                      <input type="radio" name="audio-base" checked={selected} onChange={() => selectAudioBase(i)} />
                      <span>Вариант {VARIANT_LETTERS[i] ?? i + 1}</span>
                      <MiniAudioPlayer src={url} />
                    </label>
                  ) : null;
                })}
            </div>
          ) : (
            <div className={styles.audioRowStatus}>{model.base.statusText ?? 'ещё не генерировалась'}</div>
          )}
          <p className={styles.audioPanelNote}>
            выбранный вариант уходит в бандл как <code>bgmUrl</code> и в эмбиент <code>neutral_calm</code>
          </p>
        </section>

        <section className={styles.audioPanel}>
          <header className={styles.audioPanelHead}>
            <span>Банк эмбиентов по настроениям</span>
            <span className={styles.audioPanelTag}>audioMoodBeds · LOCATION_MOODS</span>
          </header>
          <div className={styles.audioBankGrid}>
            {model.moodRows.map(row => (
              <BankRow key={row.key} row={row} onSelect={index => selectAudioMoodBed(row.key, index)} />
            ))}
          </div>
        </section>
      </div>

      <div className={styles.audioColumn}>
        <section className={styles.audioPanel}>
          <header className={styles.audioPanelHead}>
            <span>Диегетические беды</span>
            <span className={styles.audioPanelTag}>audioSpecialBeds · SPECIAL_AMBIENT_KINDS</span>
          </header>
          <div className={styles.audioBankGrid}>
            {model.specialRows.map(row => (
              <BankRow key={row.key} row={row} onSelect={index => selectAudioSpecialBed(row.key, index)} />
            ))}
          </div>
        </section>

        <section className={styles.audioPanel}>
          <header className={styles.audioPanelHead}>
            <span>Вариации на персонажа</span>
            <span className={styles.audioPanelTag}>LiAudioState · positive / negative</span>
          </header>
          <div className={styles.audioVariationGrid}>
            <span />
            <span className={styles.audioVariationHead}>тепло (warm)</span>
            <span className={styles.audioVariationHead}>холод (cold)</span>
            {model.variationRows.map(row => (
              <React.Fragment key={row.liId}>
                <span className={styles.audioRowLabel}>{row.name}</span>
                {(['warm', 'cold'] as const).map(side => {
                  const cell = row[side];
                  const tone = side === 'warm' ? 'positive' : 'negative';
                  return (
                    <span key={side} className={`${styles.audioRowStatus} ${styles[STATUS_CLASS[cell.status]] ?? ''}`}>
                      {cell.status === 'done' ? (
                        <TrackVariants
                          track={cell.track}
                          onSelect={index => selectAudioVariation(row.liId, tone, index)}
                        />
                      ) : cell.status === 'failed' && cell.track?.status === 'failed' ? (
                        `✗ ${cell.track.error}`
                      ) : cell.status === 'generating' ? (
                        '⟳ генерируется…'
                      ) : (
                        'в очереди'
                      )}
                    </span>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <p className={styles.audioPanelNote}>
            тон в encounter-сцене переключают те же пороги, что и диалоговый брекет: a₀ ± 0.15 — без готовой вариации
            играет база
          </p>
        </section>

        <section className={styles.audioPanel}>
          <header className={styles.audioPanelHead}>
            <span>SFX-набор</span>
            <span className={styles.audioPanelTag}>по каноническим позам · idle без SFX</span>
          </header>
          <div className={styles.audioSfxChips}>
            {model.sfxChips.map(chip => {
              const url = chip.filename ? audioUrlFor(chip.filename) : undefined;
              return (
                <span
                  key={chip.emotion}
                  className={`${styles.audioSfxChip} ${
                    chip.status === 'failed'
                      ? styles.audioSfxChipBad
                      : chip.status !== 'done'
                      ? styles.audioSfxChipWait
                      : ''
                  }`}
                >
                  {chip.emotion}
                  {chip.status === 'done' && url ? <MiniAudioPlayer src={url} /> : null}
                  {chip.status === 'generating' && ' ⟳'}
                  {chip.status === 'missing' && ' ·'}
                  {chip.status === 'failed' && ' ✗'}
                </span>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AudioView;
