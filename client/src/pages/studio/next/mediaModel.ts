import { CANONICAL_POSES } from '@/narrative';
import { locationImageKey } from '@/narrative/imageFingerprint';
import { isLocationMood, LOCATION_MOOD_LABELS } from '@/narrative/types';

import type { AudioTrackState, CharacterGenState, ImageGenState, LiAudioState } from '@/narrative/narrativeStore';
import type { Brief, WorldModel } from '@/narrative/types';

/**
 * Зона 3 «Медиа»: три дорожки одного конвейера — фоны локаций, спрайты
 * персонажей, звук. Модель только читает состояние генерации и раскладывает
 * его по позициям; кто чем закрыт (какой дубль выбран) остаётся действием
 * компонента через сторовые сеттеры — сюда попадает лишь то, какую позицию
 * это затрагивает (`AudioPositionKind`), а не сам колбэк, чтобы модель
 * оставалась чистыми данными и проверялась без моков стора.
 */

export type MediaStatus = 'done' | 'generating' | 'missing' | 'failed';

type StatusLike = { status: 'pending' | 'generating' | 'done' | 'failed' } | null | undefined;

function toMediaStatus(state: StatusLike): MediaStatus {
  switch (state?.status) {
    case 'done':
      return 'done';
    case 'generating':
      return 'generating';
    case 'failed':
      return 'failed';
    default:
      // 'pending' и отсутствие записи — ещё не поставлено в очередь генерации.
      return 'missing';
  }
}

export interface BackgroundRow {
  key: string;
  locId: string;
  name: string;
  status: MediaStatus;
  filename?: string;
  error?: string;
}

export interface SpritePoseCell {
  pose: string;
  filename?: string;
  accepted: boolean;
}

export interface SpriteRow {
  key: string;
  liId: string;
  name: string;
  status: MediaStatus;
  poses: SpritePoseCell[];
  error?: string;
}

export type AudioPositionKind =
  | { kind: 'base' }
  | { kind: 'mood'; mood: string }
  | { kind: 'variation'; liId: string; tone: 'positive' | 'negative' };

export interface AudioPositionRow {
  key: string;
  label: string;
  /** Технический код позиции для моно-приписки: настроение, id LI/тон. */
  mono: string;
  status: MediaStatus;
  track: AudioTrackState | null;
  position: AudioPositionKind;
}

export interface MediaCounts {
  done: number;
  total: number;
}

export interface MediaModel {
  backgrounds: BackgroundRow[];
  sprites: SpriteRow[];
  audio: AudioPositionRow[];
  counts: {
    backgrounds: MediaCounts;
    sprites: MediaCounts;
    audio: MediaCounts;
  };
}

export interface MediaModelInputs {
  brief: Brief;
  worldModel: WorldModel | null;
  images: Record<string, ImageGenState>;
  characters: Record<string, CharacterGenState>;
  audioBase: AudioTrackState | null;
  audioMoodBeds: Record<string, AudioTrackState>;
  audioByLi: Record<string, LiAudioState>;
}

function countOf(rows: { status: MediaStatus }[]): MediaCounts {
  return { done: rows.filter(r => r.status === 'done').length, total: rows.length };
}

export function deriveMedia(inputs: MediaModelInputs): MediaModel {
  const { brief, worldModel, images, characters, audioBase, audioMoodBeds, audioByLi } = inputs;
  const loveInterests = brief.loveInterests ?? [];

  // ── Дорожка фонов: одна позиция на локацию мира ──────────────────────────
  const backgrounds: BackgroundRow[] = (worldModel?.locations ?? []).map(loc => {
    const state = images[locationImageKey(loc.id)];
    return {
      key: loc.id,
      locId: loc.id,
      name: loc.name || loc.id,
      status: toMediaStatus(state),
      filename: state?.status === 'done' ? state.filename : undefined,
      error: state?.status === 'failed' ? state.error : undefined,
    };
  });

  // ── Дорожка спрайтов: одна позиция на LI, ячейка на канонический пост ────
  const sprites: SpriteRow[] = loveInterests.map(li => {
    const state: CharacterGenState | undefined = characters[li.id];
    const done = state?.status === 'done' ? state : undefined;
    const poses: SpritePoseCell[] = CANONICAL_POSES.map(pose => {
      const filename = pose === 'idle' ? done?.idleFilename : done?.poseFilenames?.[pose];
      return { pose, filename, accepted: Boolean(filename) };
    });
    return {
      key: li.id,
      liId: li.id,
      name: li.name || li.id,
      status: toMediaStatus(state),
      poses,
      error: state?.status === 'failed' ? state.error : undefined,
    };
  });

  // ── Дорожка звука: база → банк эмбиента, реально задействованный → тепло/холодно на LI ──
  const audio: AudioPositionRow[] = [
    {
      key: 'audio:base',
      label: 'Базовая подложка',
      mono: 'neutral_calm',
      status: toMediaStatus(audioBase),
      track: audioBase,
      position: { kind: 'base' },
    },
    ...Object.entries(audioMoodBeds).map(([mood, track]) => ({
      key: `audio:mood:${mood}`,
      label: isLocationMood(mood) ? LOCATION_MOOD_LABELS[mood] : mood,
      mono: mood,
      status: toMediaStatus(track),
      track,
      position: { kind: 'mood', mood } as AudioPositionKind,
    })),
    ...loveInterests.flatMap(li => {
      const warm = audioByLi[li.id]?.positive ?? null;
      const cold = audioByLi[li.id]?.negative ?? null;
      const name = li.name || li.id;
      return [
        {
          key: `audio:li:${li.id}:positive`,
          label: `${name} · тепло`,
          mono: `${li.id}/warm`,
          status: toMediaStatus(warm),
          track: warm,
          position: { kind: 'variation', liId: li.id, tone: 'positive' } as AudioPositionKind,
        },
        {
          key: `audio:li:${li.id}:negative`,
          label: `${name} · холодно`,
          mono: `${li.id}/cold`,
          status: toMediaStatus(cold),
          track: cold,
          position: { kind: 'variation', liId: li.id, tone: 'negative' } as AudioPositionKind,
        },
      ];
    }),
  ];

  return {
    backgrounds,
    sprites,
    audio,
    counts: { backgrounds: countOf(backgrounds), sprites: countOf(sprites), audio: countOf(audio) },
  };
}
