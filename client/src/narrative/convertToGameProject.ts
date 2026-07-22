import type { Brief, DraftDialogueLine } from './types';
import type { ImageGenState } from './narrativeStore';
import { IMAGE_SERVER_BASE } from './emotionResolver';

export function imageUrlFor(state: ImageGenState | undefined): string {
  if (state?.status === 'done' && state.filename) {
    return `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(state.filename)}`;
  }
  return '';
}

/**
 * Утилиты авторской стороны, пережившие снос графового компилятора.
 *
 * Раньше здесь жила локальная копия game/-схемы (узлы, рёбра, численные
 * условия) — компилятор разворачивал в неё пул. Схема умерла вместе с
 * графом: движок читает storylet-бандл, типы которого объявлены в общем ядре
 * (story_core/bundle.ts). Осталось то, что нужно СБОРЩИКУ бандла и UI:
 * раскладка спрайтов, экранирование текста, рендер черновика сцены и
 * браузерные хелперы скачивания.
 */

/** Профиль аудио сцены — зеркало SceneAudioProfile движка. */
export type GameSceneAudioProfile = {
  liId: string;
  positiveUrl?: string;
  negativeUrl?: string;
  positiveGte: number;
  negativeLte: number;
};

export function assignPositions(count: number): Array<'left' | 'center' | 'right'> {
  if (count <= 1) return ['center'];
  if (count === 2) return ['left', 'right'];
  return ['left', 'center', 'right'];
}

export function escapeNL(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

/**
 * Резолвер id говорящего → отображаемое имя. Реплики хранят speaker как id
 * персонажа ('kira'), тогда как проза-нарратив использует имя ('Кира'). Без
 * резолва подпись реплики рассинхронизирована с текстом сцены.
 */
export type SpeakerNameResolver = (speakerId: string) => string;

export function speakerNameResolver(brief: Brief): SpeakerNameResolver {
  const byId = new Map(brief.loveInterests.map(li => [li.id, li.name]));
  return id => byId.get(id) ?? id;
}

function renderDialogue(dialogue: DraftDialogueLine[], resolveName?: SpeakerNameResolver): string {
  if (!dialogue.length) return '';
  return dialogue.map(d => `${resolveName?.(d.speaker) ?? d.speaker}: ${d.line}`).join('\n');
}

export function renderDraftSceneText(
  narration: string,
  dialogue: DraftDialogueLine[],
  resolveName?: SpeakerNameResolver,
): string {
  const parts = [escapeNL(narration)];
  const dlg = renderDialogue(dialogue, resolveName);
  if (dlg) parts.push(dlg);
  return parts.filter(Boolean).join('\n\n');
}

// Пороги тона — единственная точка истины, живёт в общем ядре: их читает и
// генератор (проводка bracket-рёбер, аудио-профили), и рантайм (выбор варианта
// диалога по affection в момент игры).
export {
  BRACKET_POSITIVE_GTE,
  BRACKET_NEGATIVE_LTE,
  LEGACY_BRACKET_THRESHOLDS,
  BRACKET_OFFSET,
  bracketThresholdsFor,
} from 'gu-engine-story-core';
export type { BracketThresholds } from 'gu-engine-story-core';

// ── Browser download helpers ──────────────────────────────────────────────

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '') || 'project'
  );
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
