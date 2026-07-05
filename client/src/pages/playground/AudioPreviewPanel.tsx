import { useState } from 'react';
import {
  useNarrativeStore,
  useBriefStore,
  audioUrlFor,
  LOCATION_MOOD_LABELS,
  SPECIAL_AMBIENT_KIND_LABELS,
} from '@/narrative';
import type { AudioTrackState, AudioVariationTone } from '@/narrative/narrativeStore';
import type { LocationMood, SpecialAmbientKind } from '@/narrative';
import { MiniAudioPlayer } from '@/pages/main/components/MiniAudioPlayer';
import styles from './playground.module.css';

const isLocationMoodKey = (k: string): k is LocationMood => k in LOCATION_MOOD_LABELS;
const isSpecialKindKey = (k: string): k is SpecialAmbientKind => k in SPECIAL_AMBIENT_KIND_LABELS;

const TONE_LABELS: Record<AudioVariationTone, string> = {
  positive: 'Позитивный',
  negative: 'Негативный',
};

const TONES: AudioVariationTone[] = ['positive', 'negative'];

/** Короткая метка для трека, который ещё не готов (done не сюда). */
function trackStatusLabel(track: AudioTrackState | undefined): string {
  switch (track?.status) {
    case 'pending':
      return 'в очереди…';
    case 'generating':
      return 'генерируется…';
    case 'failed':
      return `ошибка: ${track.error}`;
    default:
      return '—';
  }
}

/**
 * Строки-варианты одного трека: radio выбирает, какой из 2 вариантов Suno уйдёт
 * в экспорт (selected-индекс читает selectedTrackFile при компиляции проекта).
 * Для неготового трека показывает статус.
 */
const VariantRows = ({
  track,
  groupName,
  onSelect,
}: {
  track: AudioTrackState | undefined;
  groupName: string;
  onSelect: (index: number) => void;
}) => {
  if (track?.status !== 'done') {
    return <span className={styles.audioPreviewStatus}>{trackStatusLabel(track)}</span>;
  }
  return (
    <div className={styles.audioPreviewVariants}>
      {track.filenames.map((file, i) => {
        const url = audioUrlFor(file);
        return url ? (
          <label key={file} className={styles.audioPreviewVariantRow}>
            <input
              type="radio"
              name={groupName}
              checked={track.selected === i}
              onChange={() => onSelect(i)}
              title="Использовать этот вариант в экспорте"
            />
            <MiniAudioPlayer src={url} label={`Вариант ${i + 1}`} />
          </label>
        ) : null;
      })}
    </div>
  );
};

/**
 * Превью сгенерированного аудио: база + per-LI вариации (positive/negative) + SFX.
 * Позволяет прослушать треки и выбрать вариант для экспорта. Скрыт, пока нет ни
 * одного готового трека.
 */
export const AudioPreviewPanel = () => {
  const brief = useBriefStore(s => s.brief);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioMoodBeds = useNarrativeStore(s => s.audioMoodBeds);
  const audioSpecialBeds = useNarrativeStore(s => s.audioSpecialBeds);
  const audioByLi = useNarrativeStore(s => s.audioByLi);
  const audioSfx = useNarrativeStore(s => s.audioSfx);
  const audioSfxState = useNarrativeStore(s => s.audioSfxState);
  const selectAudioBase = useNarrativeStore(s => s.selectAudioBase);
  const selectAudioMoodBed = useNarrativeStore(s => s.selectAudioMoodBed);
  const selectAudioSpecialBed = useNarrativeStore(s => s.selectAudioSpecialBed);
  const selectAudioVariation = useNarrativeStore(s => s.selectAudioVariation);
  const [open, setOpen] = useState(true);

  const baseDone = audioBase?.status === 'done';
  const moodBedEntries = Object.entries(audioMoodBeds);
  const anyMoodBed = moodBedEntries.some(([, t]) => t.status === 'done');
  const specialBedEntries = Object.entries(audioSpecialBeds);
  const anySpecialBed = specialBedEntries.some(([, t]) => t.status === 'done');
  const anyVariation = Object.values(audioByLi).some(
    li => li.positive?.status === 'done' || li.negative?.status === 'done',
  );
  const sfxEntries = Object.entries(audioSfx);
  if (!baseDone && !anyMoodBed && !anySpecialBed && !anyVariation && sfxEntries.length === 0) return null;

  return (
    <section className={styles.audioPreview}>
      <div className={styles.audioPreviewHeader}>
        <h2 className={styles.sectionTitle}>
          Аудио — превью <span className={styles.sectionMeta}>прослушать и выбрать вариант для экспорта</span>
        </h2>
        <button type="button" className={styles.toggleBtn} onClick={() => setOpen(v => !v)}>
          {open ? 'Свернуть' : 'Раскрыть'}
        </button>
      </div>

      {open && (
        <div className={styles.audioPreviewBody}>
          <div className={styles.audioPreviewGroup}>
            <span className={styles.audioPreviewGroupTitle}>Базовая подложка (нейтральная)</span>
            <VariantRows track={audioBase ?? undefined} groupName="audio-base" onSelect={selectAudioBase} />
          </div>

          {moodBedEntries.length > 0 && (
            <div className={styles.audioPreviewGroup}>
              <span className={styles.audioPreviewGroupTitle}>Эмбиенты по настроению локаций</span>
              {moodBedEntries.map(([mood, track]) => (
                <div key={mood} className={styles.audioPreviewTone}>
                  <span className={styles.audioPreviewToneLabel}>
                    {isLocationMoodKey(mood) ? LOCATION_MOOD_LABELS[mood] : mood}
                  </span>
                  <VariantRows
                    track={track}
                    groupName={`audio-bed-${mood}`}
                    onSelect={i => selectAudioMoodBed(mood, i)}
                  />
                </div>
              ))}
            </div>
          )}

          {specialBedEntries.length > 0 && (
            <div className={styles.audioPreviewGroup}>
              <span className={styles.audioPreviewGroupTitle}>Особые локации (диегетика)</span>
              {specialBedEntries.map(([kind, track]) => (
                <div key={kind} className={styles.audioPreviewTone}>
                  <span className={styles.audioPreviewToneLabel}>
                    {isSpecialKindKey(kind) ? SPECIAL_AMBIENT_KIND_LABELS[kind] : kind}
                  </span>
                  <VariantRows
                    track={track}
                    groupName={`audio-special-${kind}`}
                    onSelect={i => selectAudioSpecialBed(kind, i)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className={styles.audioPreviewGroup}>
            <span className={styles.audioPreviewGroupTitle}>Вариации персонажей</span>
            {brief.loveInterests.length === 0 ? (
              <span className={styles.audioPreviewStatus}>нет персонажей в брифе</span>
            ) : (
              brief.loveInterests.map(li => {
                const liAudio = audioByLi[li.id];
                return (
                  <div key={li.id} className={styles.audioPreviewLi}>
                    <span className={styles.audioPreviewLiName}>{li.name || li.id}</span>
                    <div className={styles.audioPreviewTones}>
                      {TONES.map(tone => (
                        <div key={tone} className={styles.audioPreviewTone}>
                          <span className={styles.audioPreviewToneLabel}>{TONE_LABELS[tone]}</span>
                          <VariantRows
                            track={liAudio?.[tone]}
                            groupName={`audio-${li.id}-${tone}`}
                            onSelect={i => selectAudioVariation(li.id, tone, i)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {sfxEntries.length > 0 && (
            <div className={styles.audioPreviewGroup}>
              <span className={styles.audioPreviewGroupTitle}>
                SFX{audioSfxState?.status === 'generating' ? ' · генерируется…' : ''}
              </span>
              <div className={styles.audioPreviewSfxGrid}>
                {sfxEntries.map(([emotion, file]) => {
                  const url = audioUrlFor(file);
                  return url ? (
                    <div key={emotion} className={styles.audioPreviewSfxItem}>
                      <MiniAudioPlayer src={url} label={emotion} />
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
