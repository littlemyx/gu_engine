import type { AudioTrackState, LiAudioState } from './narrativeStore';
import type { GameSceneAudioProfile } from './convertToGameProject';
import { BRACKET_POSITIVE_GTE, BRACKET_NEGATIVE_LTE } from './convertToGameProject';
import { resolveEmotionToPose } from './emotionResolver';

export const AUDIO_SERVER_BASE = 'http://localhost:3008';

export function audioUrlFor(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  return `${AUDIO_SERVER_BASE}/audio/${encodeURIComponent(filename)}`;
}

/** Выбранный файл готового трека (или первый непустой). */
export function selectedTrackFile(track: AudioTrackState | null | undefined): string | undefined {
  if (track?.status !== 'done') return undefined;
  return track.filenames[track.selected] || track.filenames.find(Boolean);
}

/**
 * Аудио-профиль encounter-сцены для liId. Пороги — те же константы, что
 * в bracketCondition: музыкальный тон совпадает с диалоговым bracket-ом.
 * Возвращает undefined, если у LI нет ни одной готовой вариации —
 * рендерер тогда играет базу.
 */
export function buildSceneAudioProfile(
  liId: string,
  liAudio: LiAudioState | undefined,
): GameSceneAudioProfile | undefined {
  const positiveUrl = audioUrlFor(selectedTrackFile(liAudio?.positive));
  const negativeUrl = audioUrlFor(selectedTrackFile(liAudio?.negative));
  if (!positiveUrl && !negativeUrl) return undefined;
  return {
    liId,
    positiveUrl,
    negativeUrl,
    positiveGte: BRACKET_POSITIVE_GTE,
    negativeLte: BRACKET_NEGATIVE_LTE,
  };
}

/**
 * SFX сцены по эмоции говорящего: свободная эмоция нормализуется к
 * канонической позе (как у спрайтов) и ищется в SFX-наборе.
 */
export function resolveSfxUrl(emotion: string | undefined, sfx: Record<string, string>): string | undefined {
  if (!emotion) return undefined;
  const pose = resolveEmotionToPose(emotion);
  if (pose === 'idle') return undefined;
  return audioUrlFor(sfx[pose]);
}
