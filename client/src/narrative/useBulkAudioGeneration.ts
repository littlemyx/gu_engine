import { useCallback, useRef, useState } from 'react';
import {
  generateMelody,
  generateVariation,
  generateSfx,
  getAudioBatchStatus,
  type BatchStatus,
} from '@root/audio_gen/generated_client';
import type { Brief, LoveInterestCard } from './types';
import { useNarrativeStore, type AudioVariationTone } from './narrativeStore';
import { CANONICAL_POSES } from './emotionResolver';

/**
 * Bulk-генератор аудио через audio_gen:
 *   1. Базовая мелодия проекта (инструментал, стиль из brief.world.tone).
 *   2. Per-LI вариации базы (positive/negative) через Suno upload-cover.
 *      Требует готовой базы; тона строятся из personality/архетипа LI.
 *   3. SFX-набор по каноническим эмоциям (те же ключи, что у поз спрайтов).
 *
 * Resumable: пропускает треки со status='done'. 'generating' ретраится —
 * batchId живёт в памяти audio_gen и протухает при рестарте сервиса.
 * Вариации идут последовательно: каждая — отдельная Suno-задача на минуты,
 * а rate limiter в audio_gen общий.
 */

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 420_000; // 7 минут: Suno-генерация трека идёт долго

const SFX_EMOTIONS = CANONICAL_POSES.filter(p => p !== 'idle');

const SFX_PROMPTS: Record<string, string> = {
  happy: 'short joyful chime, bright, light laugh',
  sad: 'soft melancholic sigh, gentle descending notes',
  tense: 'tense string sting, suspenseful, short',
  soft: 'warm gentle bell, tender, brief',
  thoughtful: 'contemplative single piano note with reverb',
  surprised: 'quick rising glissando, startled accent',
  angry: 'sharp low hit, aggressive accent, short',
};

export type AudioBulkFailure = { key: string; error: string };

export type AudioBulkStatus =
  | { state: 'idle' }
  | {
      state: 'running';
      phase: 'base' | 'variations' | 'sfx';
      total: number;
      completed: number;
      failures: AudioBulkFailure[];
      cancelled: boolean;
    }
  | { state: 'done'; total: number; completed: number; failures: AudioBulkFailure[]; cancelled: boolean };

export function buildBaseStyle(brief: Brief): string {
  const parts: string[] = ['instrumental background melody, seamless loop'];
  if (brief.world.tone.mood) parts.push(`mood: ${brief.world.tone.mood}`);
  if (brief.world.tone.themes.length) parts.push(`themes: ${brief.world.tone.themes.join(', ')}`);
  parts.push(`setting: ${brief.world.setting.era}, ${brief.world.setting.place}`);
  return parts.join('. ');
}

export function buildToneStyle(li: LoveInterestCard, tone: AudioVariationTone): string {
  const traits = li.personality.traits.slice(0, 3).join(', ');
  if (tone === 'positive') {
    return `warm, uplifting, major key, tender; character feel: ${traits || li.name}`;
  }
  return `dark, minor key, tense strings, unsettling; character feel: ${traits || li.name}`;
}

export function useBulkAudioGeneration() {
  const [status, setStatus] = useState<AudioBulkStatus>({ state: 'idle' });
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const start = useCallback(async (brief: Brief, baseStyle: string) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;

    const store = useNarrativeStore.getState();
    const failures: AudioBulkFailure[] = [];
    // база + 2 тона на LI + один SFX-батч
    const total = 1 + brief.loveInterests.length * 2 + 1;
    let completed = 0;

    const publish = (phase: 'base' | 'variations' | 'sfx') => {
      setStatus({
        state: 'running',
        phase,
        total,
        completed,
        failures: failures.slice(),
        cancelled: cancelledRef.current,
      });
    };

    if (!(await isAudioGenReachable())) {
      setStatus({
        state: 'done',
        total: 0,
        completed: 0,
        failures: [
          {
            key: '__service__',
            error: 'audio_gen недоступен (http://localhost:3200). Запустите сервис: cd audio_gen && pnpm dev',
          },
        ],
        cancelled: false,
      });
      runningRef.current = false;
      return;
    }

    // ── 1. Базовая мелодия ────────────────────────────────────────────────
    publish('base');
    let base = useNarrativeStore.getState().audioBase;
    if (base?.status !== 'done') {
      try {
        const { data, error } = await generateMelody({
          body: { style: baseStyle, instrumental: true },
        });
        if (error || !data) throw new Error('не удалось запустить генерацию мелодии');
        store.setAudioBase({ status: 'generating', batchId: data.batchId });
        const files = await pollBatch(data.batchId);
        store.setAudioBase({ status: 'done', filenames: files, selected: 0 });
        completed++;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        failures.push({ key: 'base', error });
        store.setAudioBase({ status: 'failed', error });
      }
    } else {
      completed++;
    }
    publish('base');

    base = useNarrativeStore.getState().audioBase;
    const baseFile =
      base?.status === 'done' ? base.filenames[base.selected] || base.filenames.find(Boolean) : undefined;

    // ── 2. Per-LI вариации ────────────────────────────────────────────────
    publish('variations');
    if (baseFile) {
      for (const li of brief.loveInterests) {
        for (const tone of ['positive', 'negative'] as const) {
          if (cancelledRef.current) break;
          const existing = useNarrativeStore.getState().audioByLi[li.id]?.[tone];
          if (existing?.status === 'done') {
            completed++;
            publish('variations');
            continue;
          }
          try {
            const { data, error } = await generateVariation({
              body: { baseAudioName: baseFile, toneStyle: buildToneStyle(li, tone), variationType: tone },
            });
            if (error || !data) throw new Error('не удалось запустить генерацию вариации');
            store.setAudioVariation(li.id, tone, { status: 'generating', batchId: data.batchId });
            const files = await pollBatch(data.batchId);
            store.setAudioVariation(li.id, tone, { status: 'done', filenames: files, selected: 0 });
            completed++;
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            failures.push({ key: `${li.id}:${tone}`, error });
            store.setAudioVariation(li.id, tone, { status: 'failed', error });
          }
          publish('variations');
        }
        if (cancelledRef.current) break;
      }
    } else {
      for (const li of brief.loveInterests) {
        failures.push({ key: `${li.id}`, error: 'нет базовой мелодии — вариации пропущены' });
      }
    }

    // ── 3. SFX-набор ──────────────────────────────────────────────────────
    publish('sfx');
    const existingSfx = useNarrativeStore.getState().audioSfx;
    const missingSfx = SFX_EMOTIONS.filter(e => !existingSfx[e]);
    if (!cancelledRef.current && missingSfx.length > 0) {
      try {
        const items = missingSfx.map(emotion => ({
          id: emotion,
          prompt: SFX_PROMPTS[emotion] ?? `short ${emotion} emotional sound accent`,
        }));
        const { data, error } = await generateSfx({ body: { items } });
        if (error || !data) throw new Error('не удалось запустить генерацию SFX');
        store.setAudioSfxState({ status: 'generating', batchId: data.batchId });
        const fileById = await pollBatchById(data.batchId);
        for (const [emotion, file] of Object.entries(fileById)) {
          store.setAudioSfx(emotion, file);
        }
        store.setAudioSfxState({ status: 'done', filenames: Object.values(fileById), selected: 0 });
        completed++;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        failures.push({ key: 'sfx', error });
        store.setAudioSfxState({ status: 'failed', error });
      }
    } else {
      completed++;
    }

    setStatus({ state: 'done', total, completed, failures, cancelled: cancelledRef.current });
    runningRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setStatus({ state: 'idle' });
  }, []);

  return { status, start, cancel, reset };
}

/** Поллит батч до done, возвращает файлы в порядке itemIds (variant_1, variant_2). */
async function pollBatch(batchId: string): Promise<string[]> {
  const byId = await pollBatchById(batchId);
  const files = Object.entries(byId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, file]) => file);
  if (files.length === 0) throw new Error('батч завершился без файлов');
  return files;
}

async function pollBatchById(batchId: string): Promise<Record<string, string>> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('timeout: аудио-батч не завершился за 7 минут');
    }
    await sleep(POLL_INTERVAL_MS);
    const { data, error } = await getAudioBatchStatus({ path: { batchId } });
    if (error || !data) throw new Error('аудио-батч не найден на сервере');
    const s = data as BatchStatus;
    if (!s.done) continue;

    const result: Record<string, string> = {};
    for (const c of s.completed) {
      if (c.file) result[c.id] = c.file;
    }
    if (Object.keys(result).length === 0) {
      const firstError = s.failed[0]?.error;
      throw new Error(firstError ?? 'все элементы батча провалились');
    }
    return result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isAudioGenReachable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:3200/status', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
