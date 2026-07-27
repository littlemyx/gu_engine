import {
  CANONICAL_POSES,
  DEFAULT_LOCATION_MOOD,
  isLocationMood,
  isSpecialAmbientKind,
  LOCATION_MOOD_LABELS,
  LOCATION_MOODS,
  SPECIAL_AMBIENT_KIND_LABELS,
  SPECIAL_AMBIENT_KINDS,
} from '@/narrative';

import type { AudioTrackState, LiAudioState } from '@/narrative/narrativeStore';
import type { Brief, LocationMood, SpecialAmbientKind, WorldModel } from '@/narrative';

/**
 * Derive-модель вкладки «Аудио» (макет 7a): банк треков, счётчики готовности
 * и статусы для иерархии. Ничего не персистит — всё выводится из narrativeStore.
 *
 * Счёт «N/M треков» повторяет план bulk-генератора: база + mood-беды реально
 * используемых настроений (кроме neutral_calm — он живёт в базе) + диегетика
 * присутствующих особых типов + 2 вариации на LI + SFX по эмоциям.
 */

export type AudioRowStatus = 'done' | 'generating' | 'failed' | 'missing' | 'unused';

export type AudioTrackRow = {
  key: string;
  /** Русская метка строки: настроение, тип, имя персонажа. */
  label: string;
  /** Моноширинная приписка: технический ключ, пример локации. */
  mono: string;
  status: AudioRowStatus;
  /** Текст статуса для неготовых: «в очереди», «нет таких локаций», ошибка. */
  statusText?: string;
  track: AudioTrackState | null;
};

export type AudioVariationRow = {
  liId: string;
  name: string;
  warm: { status: AudioRowStatus; track: AudioTrackState | null };
  cold: { status: AudioRowStatus; track: AudioTrackState | null };
};

export type AudioSfxChip = {
  emotion: string;
  status: 'done' | 'generating' | 'failed' | 'missing';
  filename?: string;
};

export type AudioPhaseCount = { done: number; total: number };

export type AudioModel = {
  base: { status: AudioRowStatus; statusText?: string; track: AudioTrackState | null };
  moodRows: AudioTrackRow[];
  specialRows: AudioTrackRow[];
  variationRows: AudioVariationRow[];
  sfxChips: AudioSfxChip[];
  /** Треков в плане прогона и сколько из них готово. */
  total: number;
  done: number;
  /** Счётчики по фазам конвейера base → beds → variations → sfx. */
  phases: { base: AudioPhaseCount; beds: AudioPhaseCount; variations: AudioPhaseCount; sfx: AudioPhaseCount };
  /** Есть хоть один живой процесс генерации в банке. */
  generating: boolean;
  /** Есть хоть одна ошибка. */
  failed: boolean;
};

export type AudioModelInputs = {
  brief: Brief;
  worldModel: WorldModel | null;
  audioBase: AudioTrackState | null;
  audioMoodBeds: Record<string, AudioTrackState>;
  audioSpecialBeds: Record<string, AudioTrackState>;
  audioByLi: Record<string, LiAudioState>;
  audioSfx: Record<string, string>;
  audioSfxState: AudioTrackState | null;
};

/** SFX генерятся по каноническим эмоциям; idle — нейтральная стойка без звука. */
export const SFX_EMOTIONS = CANONICAL_POSES.filter(p => p !== 'idle');

const trackStatus = (track: AudioTrackState | null | undefined): AudioRowStatus => {
  switch (track?.status) {
    case 'done':
      return 'done';
    case 'generating':
    case 'pending':
      return 'generating';
    case 'failed':
      return 'failed';
    default:
      return 'missing';
  }
};

const statusText = (status: AudioRowStatus, track: AudioTrackState | null | undefined): string | undefined => {
  if (status === 'generating') return track?.status === 'pending' ? 'в очереди' : '⟳ генерируется…';
  if (status === 'failed') return track?.status === 'failed' ? `✗ ${track.error}` : '✗ ошибка';
  if (status === 'missing') return 'в очереди';
  return undefined;
};

export function deriveAudioModel(inputs: AudioModelInputs): AudioModel {
  const { brief, worldModel, audioBase, audioMoodBeds, audioSpecialBeds, audioByLi, audioSfx, audioSfxState } = inputs;

  const locations = worldModel?.locations ?? [];
  const usedMoods = new Set<LocationMood>(
    locations
      .map(l => (isLocationMood(l.mood) ? l.mood : DEFAULT_LOCATION_MOOD))
      .filter(m => m !== DEFAULT_LOCATION_MOOD),
  );
  const usedSpecials = new Set<SpecialAmbientKind>(locations.map(l => l.specialKind).filter(isSpecialAmbientKind));

  // ── Базовая подложка ──────────────────────────────────────────────────────
  const baseStatus = trackStatus(audioBase);
  const base = { status: baseStatus, statusText: statusText(baseStatus, audioBase), track: audioBase };

  // ── Банк эмбиентов: все 9 настроений, неиспользуемые приглушены ──────────
  const moodRows: AudioTrackRow[] = LOCATION_MOODS.map(mood => {
    if (mood === DEFAULT_LOCATION_MOOD) {
      // Не отдельный трек: нейтральные локации играют базовую подложку.
      return {
        key: mood,
        label: LOCATION_MOOD_LABELS[mood],
        mono: mood,
        status: 'unused',
        statusText: '= базовая подложка',
        track: null,
      };
    }
    const track = audioMoodBeds[mood] ?? null;
    if (!usedMoods.has(mood) && !track) {
      return {
        key: mood,
        label: LOCATION_MOOD_LABELS[mood],
        mono: mood,
        status: 'unused',
        statusText: 'нет таких локаций',
        track: null,
      };
    }
    const status = trackStatus(track);
    return {
      key: mood,
      label: LOCATION_MOOD_LABELS[mood],
      mono: mood,
      status,
      statusText: statusText(status, track),
      track,
    };
  });

  // ── Диегетические беды: все типы, пример локации в моно-приписке ─────────
  const specialRows: AudioTrackRow[] = SPECIAL_AMBIENT_KINDS.map(kind => {
    const example = locations.find(l => l.specialKind === kind);
    const track = audioSpecialBeds[kind] ?? null;
    const mono = example ? `${kind} · ${example.name || example.id}` : kind;
    if (!usedSpecials.has(kind) && !track) {
      return {
        key: kind,
        label: SPECIAL_AMBIENT_KIND_LABELS[kind],
        mono,
        status: 'unused',
        statusText: 'нет таких локаций',
        track: null,
      };
    }
    const status = trackStatus(track);
    return {
      key: kind,
      label: SPECIAL_AMBIENT_KIND_LABELS[kind],
      mono,
      status,
      statusText: statusText(status, track),
      track,
    };
  });

  // ── Вариации на персонажа: warm/cold ─────────────────────────────────────
  const variationRows: AudioVariationRow[] = brief.loveInterests.map(li => {
    const warm = audioByLi[li.id]?.positive ?? null;
    const cold = audioByLi[li.id]?.negative ?? null;
    return {
      liId: li.id,
      name: li.name || li.id,
      warm: { status: trackStatus(warm), track: warm },
      cold: { status: trackStatus(cold), track: cold },
    };
  });

  // ── SFX-чипы по эмоциям ──────────────────────────────────────────────────
  const sfxBatch = trackStatus(audioSfxState);
  const sfxChips: AudioSfxChip[] = SFX_EMOTIONS.map(emotion => {
    const filename = audioSfx[emotion];
    if (filename) return { emotion, status: 'done', filename };
    if (sfxBatch === 'generating') return { emotion, status: 'generating' };
    if (sfxBatch === 'failed') return { emotion, status: 'failed' };
    return { emotion, status: 'missing' };
  });

  // ── Счётчики плана прогона: по фазам конвейера ───────────────────────────
  const phases = {
    base: { done: base.status === 'done' ? 1 : 0, total: 1 },
    beds: {
      done:
        [...usedMoods].filter(m => audioMoodBeds[m]?.status === 'done').length +
        [...usedSpecials].filter(k => audioSpecialBeds[k]?.status === 'done').length,
      total: usedMoods.size + usedSpecials.size,
    },
    variations: {
      done: variationRows.reduce(
        (acc, row) => acc + (row.warm.status === 'done' ? 1 : 0) + (row.cold.status === 'done' ? 1 : 0),
        0,
      ),
      total: brief.loveInterests.length * 2,
    },
    sfx: { done: sfxChips.filter(c => c.status === 'done').length, total: SFX_EMOTIONS.length },
  };
  const total = phases.base.total + phases.beds.total + phases.variations.total + phases.sfx.total;
  const done = phases.base.done + phases.beds.done + phases.variations.done + phases.sfx.done;

  const allRows = [base, ...moodRows, ...specialRows, ...variationRows.flatMap(r => [r.warm, r.cold])];
  const generating = allRows.some(r => r.status === 'generating') || sfxBatch === 'generating';
  const failed = allRows.some(r => r.status === 'failed') || sfxChips.some(c => c.status === 'failed');

  return { base, moodRows, specialRows, variationRows, sfxChips, total, done, phases, generating, failed };
}
