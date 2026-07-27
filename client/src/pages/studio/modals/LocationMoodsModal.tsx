import React, { useState } from 'react';

import {
  DEFAULT_LOCATION_MOOD,
  isLocationMood,
  LOCATION_MOOD_LABELS,
  LOCATION_MOODS,
  SPECIAL_AMBIENT_KIND_LABELS,
  SPECIAL_AMBIENT_KINDS,
} from '@/narrative';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import ActionButton from '@/ui/ActionButton';

import Modal from './Modal';

import styles from './modals.module.css';

import type { AudioTrackState } from '@/narrative/narrativeStore';
import type { LocationMood, SpecialAmbientKind, WorldLocation } from '@/narrative';

export interface LocationMoodsModalProps {
  onClose: () => void;
  /** Запуск аудио-конвейера: настроения выставляются ровно перед ним. */
  onGenerateAudio: () => void;
  generateDisabledReason?: string;
}

type TrackView = { text: string; tone: 'ok' | 'wait' | 'bad' | 'muted' | 'accent' };

/**
 * Статус трека локации = статус её эффективного бакета: особый тип даёт
 * диегетический бед, иначе настроение; neutral_calm не отдельный трек,
 * а базовая подложка.
 */
const trackView = (
  loc: WorldLocation,
  changed: boolean,
  beds: {
    base: AudioTrackState | null;
    mood: Record<string, AudioTrackState>;
    special: Record<string, AudioTrackState>;
  },
): TrackView => {
  const mood = isLocationMood(loc.mood) ? loc.mood : DEFAULT_LOCATION_MOOD;
  const state = loc.specialKind ? beds.special[loc.specialKind] : mood === 'neutral_calm' ? beds.base : beds.mood[mood];

  if (!state) return changed ? { text: 'сброшен', tone: 'accent' } : { text: 'нет', tone: 'muted' };
  switch (state.status) {
    case 'done':
      return { text: '✓', tone: 'ok' };
    case 'generating':
    case 'pending':
      return { text: '⟳', tone: 'wait' };
    default:
      return { text: '✗', tone: 'bad' };
  }
};

const TONE_CLASS: Record<TrackView['tone'], string> = {
  ok: 'moodTrackOk',
  wait: 'moodTrackWait',
  bad: 'moodTrackBad',
  muted: 'moodTrackMuted',
  accent: 'moodTrackAccent',
};

/**
 * «Настроения локаций · перед генерацией аудио» (макет 7c): авторский
 * оверрайд mood/specialKind через patchLocation. Особый тип глушит
 * настроение; смена значения делает готовый трек локации неактуальным.
 */
const LocationMoodsModal = ({ onClose, onGenerateAudio, generateDisabledReason }: LocationMoodsModalProps) => {
  const worldModel = useNarrativeStore(s => s.worldModel);
  const patchLocation = useNarrativeStore(s => s.patchLocation);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioMoodBeds = useNarrativeStore(s => s.audioMoodBeds);
  const audioSpecialBeds = useNarrativeStore(s => s.audioSpecialBeds);

  // Правленные в этой сессии диалога локации: бейдж «изменено» + статус
  // «сброшен» вместо безликого «нет», пока новый бед не сгенерирован.
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const markChanged = (id: string) => setChanged(prev => new Set(prev).add(id));

  const locations = worldModel?.locations ?? [];
  const beds = { base: audioBase, mood: audioMoodBeds, special: audioSpecialBeds };

  return (
    <Modal
      title="Настроения локаций"
      subtitle="настроение выбирает эмбиент из банка; особый тип даёт диегетическую подложку вместо mood-бакета. Смена значения сбрасывает готовый трек локации."
      broad
      onClose={onClose}
      footer={
        <>
          <span className={styles.footerStatus}>особый тип глушит настроение — у особой локации играет диегетика</span>
          <ActionButton
            onLight
            label="Сгенерировать аудио"
            cost="≈ $0.02 за трек"
            disabled={Boolean(generateDisabledReason)}
            reason={generateDisabledReason}
            onClick={() => {
              onClose();
              onGenerateAudio();
            }}
          />
        </>
      }
    >
      {locations.length === 0 ? (
        <p className={styles.note}>Локаций ещё нет — мир строит фаза worldCalendar календарного прогона.</p>
      ) : (
        <div className={styles.moodTable}>
          <span className={styles.moodHeadCell}>Локация</span>
          <span className={styles.moodHeadCell}>Настроение</span>
          <span className={styles.moodHeadCell}>Особый тип</span>
          <span className={styles.moodHeadCell}>Трек</span>

          {locations.map(loc => {
            const muted = loc.specialKind != null;
            const track = trackView(loc, changed.has(loc.id), beds);
            return (
              <React.Fragment key={loc.id}>
                <span className={styles.moodNameCell}>
                  <span className={styles.moodTitle}>{loc.name || loc.id}</span>
                  <span className={styles.mono}>{loc.id}</span>
                  {changed.has(loc.id) && <span className={styles.moodChangedBadge}>изменено</span>}
                </span>
                <select
                  className={`${styles.input} ${styles.moodSelect} ${muted ? styles.moodSelectMuted : ''} ${
                    changed.has(loc.id) ? styles.moodSelectChanged : ''
                  }`}
                  title={muted ? 'особый тип имеет приоритет — настроение не играет' : undefined}
                  value={isLocationMood(loc.mood) ? loc.mood : DEFAULT_LOCATION_MOOD}
                  onChange={e => {
                    patchLocation(loc.id, { mood: e.target.value as LocationMood });
                    markChanged(loc.id);
                  }}
                >
                  {LOCATION_MOODS.map(m => (
                    <option key={m} value={m}>
                      {LOCATION_MOOD_LABELS[m]}
                    </option>
                  ))}
                </select>
                <select
                  className={`${styles.input} ${styles.moodSelect}`}
                  value={loc.specialKind ?? ''}
                  onChange={e => {
                    patchLocation(loc.id, {
                      specialKind: e.target.value ? (e.target.value as SpecialAmbientKind) : null,
                    });
                    markChanged(loc.id);
                  }}
                >
                  <option value="">— обычная —</option>
                  {SPECIAL_AMBIENT_KINDS.map(k => (
                    <option key={k} value={k}>
                      {SPECIAL_AMBIENT_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <span className={`${styles.moodTrackCell} ${styles[TONE_CLASS[track.tone]]}`}>{track.text}</span>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default LocationMoodsModal;
