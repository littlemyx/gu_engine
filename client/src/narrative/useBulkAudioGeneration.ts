import { useCallback, useRef, useState } from 'react';
import {
  generateMelody,
  generateVariation,
  generateSfx,
  getAudioBatchStatus,
  type BatchStatus,
} from '@root/audio_gen/generated_client';
import type { ArtStyle, Brief, LocationMood, LoveInterestCard, SpecialAmbientKind } from './types';
import { DEFAULT_LOCATION_MOOD } from './types';
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
      phase: 'base' | 'beds' | 'variations' | 'sfx';
      total: number;
      completed: number;
      failures: AudioBulkFailure[];
      cancelled: boolean;
    }
  | { state: 'done'; total: number; completed: number; failures: AudioBulkFailure[]; cancelled: boolean };

/**
 * Одна инструментовочная клауза, выведенная из визуального стиля проекта
 * (brief.artStyle.referenceDescriptor). Подставляется во ВСЕ mood-шаблоны, так
 * что весь банк эмбиентов звучит как один проект и совпадает с задниками.
 * Fuzzy-lookup по ключевым словам, нейтральный дефолт для незнакомых стилей.
 */
export function deriveArtStyleTimbre(artStyle: ArtStyle): string {
  const ref = (artStyle.referenceDescriptor || '').toLowerCase();
  const has = (...kws: string[]) => kws.some(k => ref.includes(k));
  if (has('watercolor', 'painterly', 'impressionist', 'gouache'))
    return 'impressionist solo piano and harp, soft felt textures';
  if (has('noir', 'ink', 'high-contrast', 'high contrast', 'monochrome'))
    return 'sparse low strings and muted double bass, film-noir chamber';
  if (has('lo-fi', 'lofi', 'pixel', 'retro', '8-bit', '8bit'))
    return 'warm tape-saturated synth pads, mellow Rhodes, vinyl hiss';
  if (has('anime', 'cel-shaded', 'cel shaded', 'manga')) return 'clean nylon guitar and celesta, light woodwinds';
  if (has('storybook', 'pastel', 'fairytale', 'fairy tale', 'children'))
    return 'music-box, glockenspiel and gentle strings';
  if (has('cyber', 'neon', 'synthwave', 'sci-fi', 'sci fi', 'futuristic'))
    return 'analog synth pads and drones, no arpeggio';
  if (has('oil', 'renaissance', 'classical', 'baroque', 'realistic', 'photoreal'))
    return 'string quartet and solo oboe, chamber acoustic';
  return 'soft neutral piano and warm pads';
}

/** Аппендится КО ВСЕМ mood-стилям: держит трек фоновым, глушит задорность. */
const AMBIENT_NEGATIVE_TAIL =
  ', no drums, no beat, no percussion, no vocals, no lead melody, ambient underscore, seamless loop';

/**
 * Шаблоны эмбиент-подложек по настроению. `{timbre}` заменяется на
 * deriveArtStyleTimbre. Расширять набор = добавить ключ в LOCATION_MOODS (types.ts)
 * и запись сюда (+ строку в промпт world-model). Слова-магниты задорности
 * (melody/upbeat/catchy/dance) сюда не попадают — только underscore/pad/drone.
 */
export const MOOD_STYLE_TEMPLATES: Record<LocationMood, string> = {
  neutral_calm: '{timbre}, calm neutral ambient underscore, gentle sustained pads, unhurried, soft-focus',
  cheerful_warm: '{timbre}, warm bright ambient underscore, gently optimistic, airy major-leaning harmony, sunlit',
  cozy_tender: '{timbre}, intimate cozy ambient underscore, tender close-mic warmth, hearthlike',
  romantic: '{timbre}, tender romantic ambient underscore, warm intimate harmony, slow swelling pads, dusk glow',
  melancholic_sad:
    '{timbre}, melancholic ambient underscore, slow minor-leaning harmony, distant and rainy, quiet ache',
  wistful_nostalgic: '{timbre}, wistful nostalgic ambient underscore, faded bittersweet harmony, gentle reverb haze',
  tense_anxious:
    '{timbre}, tense anxious ambient underscore, low sustained drone, subtle dissonant swell, uneasy stillness',
  ominous_mysterious:
    '{timbre}, ominous mysterious ambient underscore, dark low drone, sparse unresolved intervals, cold air',
  tragic_heavy:
    '{timbre}, tragic heavy ambient underscore, deep mournful sustained low strings, slow grief-laden swell',
};

/** Style-строка эмбиент-беда: mood-шаблон + тембр из artStyle + негативный хвост. */
export function buildAmbientStyle(mood: LocationMood, timbre: string, contextHint?: string): string {
  const core = MOOD_STYLE_TEMPLATES[mood].replace('{timbre}', timbre);
  const ctx = contextHint ? `, ${contextHint}` : '';
  return `${core}${ctx}${AMBIENT_NEGATIVE_TAIL}`;
}

/**
 * Диегетические подложки особых локаций (Phase 2). У каждой — СВОЙ хвост
 * (у толпы стадиона/рынка нужен голос-гул, поэтому общий 'no vocals' не годится).
 * `{timbre}` подставляется там, где под звук ложится музыкальная составляющая.
 */
export const SPECIAL_STYLE_TEMPLATES: Record<SpecialAmbientKind, string> = {
  bar_tavern:
    '{timbre} reinterpreted as low-volume diegetic bar music, warm background jazz-lounge feel, muffled room ambience, clinking glasses murmur, no vocals, seamless loop',
  party_club:
    '{timbre} as muffled distant dance music heard through a wall, low-pass filtered pad, crowd chatter bed, no clear beat, no vocals, seamless loop',
  sports_stadium:
    'diegetic stadium crowd ambience, distant roar and chants swelling and receding, open-air reverb, occasional whistle, no music, seamless loop',
  market_street:
    'diegetic open-air market ambience, layered distant chatter, footsteps and stalls, gentle {timbre} pad far underneath, no beat, seamless loop',
  ceremony:
    '{timbre} as solemn ceremonial underscore, slow reverent sustained tones, hall reverb, dignified, no drums, no vocals, seamless loop',
};

/** Style-строка диегетического беда особой локации (тембр проекта где уместно). */
export function buildSpecialAmbientStyle(kind: SpecialAmbientKind, timbre: string): string {
  return SPECIAL_STYLE_TEMPLATES[kind].replace('{timbre}', timbre);
}

/**
 * Базовая/фолбэк-подложка проекта — нейтральный эмбиент в тембре проекта.
 * Больше НЕ содержит слова 'melody' (главный триггер задорности): роль сменена
 * на ambient underscore, а инструментовка выводится из brief.artStyle.
 */
export function buildBaseStyle(brief: Brief): string {
  const timbre = deriveArtStyleTimbre(brief.artStyle);
  const setting = [brief.world.setting.era, brief.world.setting.place].filter(Boolean).join(', ');
  return buildAmbientStyle(DEFAULT_LOCATION_MOOD, timbre, setting ? `setting: ${setting}` : undefined);
}

/**
 * Per-LI вариация базового беда = ТОНКИЙ affect-сдвиг (не смена лада/инструментов).
 * Cover сохраняет тембр базы; строка лишь чуть теплее/прохладнее по affection,
 * чтобы все треки проекта звучали как один саунд-дизайн.
 */
export function buildToneStyle(li: LoveInterestCard, tone: AudioVariationTone): string {
  const traits = li.personality.traits.slice(0, 2).join(', ');
  const feel = traits ? `, character feel: ${traits}` : '';
  if (tone === 'positive') {
    return `same instrumentation and tempo, very subtly warmer and more open, one shade brighter, minimal change, ambient underscore, no vocals${feel}`;
  }
  return `same instrumentation and tempo, very subtly cooler and more shadowed, one shade darker, minimal change, ambient underscore, no vocals${feel}`;
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

    // Настроения, реально используемые локациями (кроме neutral_calm — он живёт
    // в базе). Один бед на настроение, переиспользуется всеми локациями этого
    // настроения. Тембр выводится из визуального стиля проекта.
    const timbre = deriveArtStyleTimbre(brief.artStyle);
    const worldModel = useNarrativeStore.getState().worldModel;
    const usedMoods: LocationMood[] = worldModel
      ? [...new Set(worldModel.locations.map(l => l.mood))].filter(m => m !== DEFAULT_LOCATION_MOOD)
      : [];
    // Особые локации (бар/стадион/…) — один диегетический бед на присутствующий
    // specialKind, переиспользуется всеми локациями этого типа.
    const usedSpecials: SpecialAmbientKind[] = worldModel
      ? [...new Set(worldModel.locations.map(l => l.specialKind).filter((k): k is SpecialAmbientKind => k != null))]
      : [];

    // база + mood-беды + special-беды + 2 тона на LI + один SFX-батч
    const total = 1 + usedMoods.length + usedSpecials.length + brief.loveInterests.length * 2 + 1;
    let completed = 0;

    const publish = (phase: 'base' | 'beds' | 'variations' | 'sfx') => {
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
            error: 'audio_gen недоступен (http://localhost:3300). Запустите сервис: cd audio_gen && pnpm dev',
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

    // ── 2. Банк эмбиентов по настроению локаций ───────────────────────────
    // Каждое реально используемое настроение (кроме neutral_calm = база) — один
    // спокойный бед в тембре проекта. Resumable: готовые пропускаются.
    publish('beds');
    for (const mood of usedMoods) {
      if (cancelledRef.current) break;
      const existingBed = useNarrativeStore.getState().audioMoodBeds[mood];
      if (existingBed?.status === 'done') {
        completed++;
        publish('beds');
        continue;
      }
      try {
        const { data, error } = await generateMelody({
          body: { style: buildAmbientStyle(mood, timbre), instrumental: true },
        });
        if (error || !data) throw new Error('не удалось запустить генерацию эмбиента');
        store.setAudioMoodBed(mood, { status: 'generating', batchId: data.batchId });
        const files = await pollBatch(data.batchId);
        store.setAudioMoodBed(mood, { status: 'done', filenames: files, selected: 0 });
        completed++;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        failures.push({ key: `bed:${mood}`, error });
        store.setAudioMoodBed(mood, { status: 'failed', error });
      }
      publish('beds');
    }

    // ── 2b. Диегетические беды особых локаций ─────────────────────────────
    for (const kind of usedSpecials) {
      if (cancelledRef.current) break;
      const existingSpecial = useNarrativeStore.getState().audioSpecialBeds[kind];
      if (existingSpecial?.status === 'done') {
        completed++;
        publish('beds');
        continue;
      }
      try {
        const { data, error } = await generateMelody({
          body: { style: buildSpecialAmbientStyle(kind, timbre), instrumental: true },
        });
        if (error || !data) throw new Error('не удалось запустить генерацию спец-эмбиента');
        store.setAudioSpecialBed(kind, { status: 'generating', batchId: data.batchId });
        const files = await pollBatch(data.batchId);
        store.setAudioSpecialBed(kind, { status: 'done', filenames: files, selected: 0 });
        completed++;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        failures.push({ key: `special:${kind}`, error });
        store.setAudioSpecialBed(kind, { status: 'failed', error });
      }
      publish('beds');
    }

    // ── 3. Per-LI вариации ────────────────────────────────────────────────
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

    // ── 4. SFX-набор ──────────────────────────────────────────────────────
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
    const res = await fetch('http://localhost:3300/status', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
