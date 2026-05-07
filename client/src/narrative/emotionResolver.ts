import type { DraftScene, GeneratedSegment, OutlinePlan } from './types';
import type { CharacterGenState } from './narrativeStore';

export const IMAGE_SERVER_BASE = 'http://localhost:3007';

export const CANONICAL_POSES = ['idle', 'happy', 'sad', 'tense', 'soft', 'thoughtful', 'surprised', 'angry'] as const;

export type CanonicalPose = typeof CANONICAL_POSES[number];

export const EMOTION_TO_POSE: Record<string, CanonicalPose> = {
  idle: 'idle',
  happy: 'happy',
  joy: 'happy',
  cheerful: 'happy',
  sad: 'sad',
  melancholy: 'sad',
  tense: 'tense',
  nervous: 'tense',
  anxious: 'tense',
  soft: 'soft',
  gentle: 'soft',
  tender: 'soft',
  thoughtful: 'thoughtful',
  pensive: 'thoughtful',
  contemplative: 'thoughtful',
  surprised: 'surprised',
  shocked: 'surprised',
  angry: 'angry',
  furious: 'angry',
  irritated: 'angry',
  neutral: 'idle',
  calm: 'idle',
};

export function resolveEmotionToPose(emotion: string | undefined): CanonicalPose {
  if (!emotion) return 'idle';
  return EMOTION_TO_POSE[emotion.toLowerCase().trim()] ?? 'idle';
}

export type SpriteResolution = {
  url: string;
  pose: string;
  isFallback: boolean;
};

export function resolveEmotionToSpriteUrl(
  state: CharacterGenState | undefined,
  emotion: string | undefined,
): SpriteResolution {
  const empty: SpriteResolution = { url: '', pose: 'idle', isFallback: false };
  if (state?.status !== 'done') return empty;

  const normalized = emotion?.toLowerCase().trim();
  const pose = resolveEmotionToPose(emotion);

  if (pose !== 'idle' && state.poseFilenames?.[pose]) {
    return {
      url: `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(state.poseFilenames[pose])}`,
      pose,
      isFallback: false,
    };
  }

  if (normalized && normalized !== 'idle' && state.poseFilenames?.[normalized]) {
    return {
      url: `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(state.poseFilenames[normalized])}`,
      pose: normalized,
      isFallback: false,
    };
  }

  const hadSpecificEmotion = !!normalized && normalized !== 'idle';
  if (state.idleFilename) {
    return {
      url: `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(state.idleFilename)}`,
      pose: 'idle',
      isFallback: hadSpecificEmotion,
    };
  }

  return empty;
}

export function pickCharacterEmotion(scene: DraftScene, charId: string): string | undefined {
  if (scene.characterEmotions?.[charId]) return scene.characterEmotions[charId];
  for (const line of scene.dialogue) {
    if (line.speaker === charId && line.emotion) return line.emotion;
  }
  return undefined;
}

export function collectUsedEmotions(
  segments: Record<string, GeneratedSegment>,
  outline: OutlinePlan,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  const ensure = (charId: string) => {
    if (!result.has(charId)) result.set(charId, new Set());
  };

  for (const anchor of outline.anchors) {
    if (anchor.characterFocus && anchor.characterEmotion) {
      ensure(anchor.characterFocus);
      result.get(anchor.characterFocus)!.add(anchor.characterEmotion);
    }
  }

  for (const seg of Object.values(segments)) {
    for (const scene of seg.scenes) {
      if (scene.characterEmotions) {
        for (const [charId, emotion] of Object.entries(scene.characterEmotions)) {
          ensure(charId);
          result.get(charId)!.add(emotion);
        }
      }
      for (const line of scene.dialogue) {
        if (line.emotion) {
          ensure(line.speaker);
          result.get(line.speaker)!.add(line.emotion);
        }
      }
    }
  }

  return result;
}

export function findMissingPoses(
  usedEmotions: Map<string, Set<string>>,
  characters: Record<string, CharacterGenState>,
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const [charId, emotions] of usedEmotions) {
    const state = characters[charId];
    const missing: string[] = [];

    for (const rawEmotion of emotions) {
      const normalized = rawEmotion.toLowerCase().trim();
      if (normalized === 'idle' || normalized === 'neutral' || normalized === 'calm') continue;

      const pose = resolveEmotionToPose(rawEmotion);

      if (pose !== 'idle') {
        if (state?.status !== 'done' || !state.poseFilenames?.[pose]) {
          missing.push(pose);
        }
      } else {
        if (state?.status !== 'done' || !state.poseFilenames?.[normalized]) {
          missing.push(normalized);
        }
      }
    }

    const unique = [...new Set(missing)];
    if (unique.length > 0) result.set(charId, unique);
  }

  return result;
}
