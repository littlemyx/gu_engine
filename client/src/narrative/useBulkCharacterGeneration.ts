import { useCallback, useRef, useState } from 'react';
import { generateCharacter, getBatchStatus, type BatchStatus } from '@root/image_gen/generated_client';
import type { Brief, LoveInterestCard, OutlinePlan } from './types';
import { useNarrativeStore } from './narrativeStore';

/**
 * Bulk-генератор спрайтов персонажей через image_gen /generate/character.
 *
 * Генерируем idle + эмоциональные позы для каждого LI.
 * Сервис получает poses[], генерирует idle первым (как reference), затем
 * остальные позы параллельно. Результат — idleFilename + poseFilenames map.
 *
 * Resumable: пропускает LI, у которых уже есть сгенерированный спрайт.
 * Concurrency = 2 (character generation тяжелее background-а).
 */

const EMOTION_POSES = ['happy', 'sad', 'tense', 'soft', 'thoughtful', 'surprised', 'angry'] as const;

const CONCURRENCY = 2;
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 360_000; // 6 минут

export type CharacterBulkFailure = { liId: string; error: string };

export type CharacterBulkStatus =
  | { state: 'idle' }
  | {
      state: 'running';
      total: number;
      completed: number;
      inFlight: number;
      remaining: number;
      failures: CharacterBulkFailure[];
      cancelled: boolean;
    }
  | {
      state: 'done';
      total: number;
      completed: number;
      failures: CharacterBulkFailure[];
      cancelled: boolean;
    };

function buildMasterPrompt(brief: Brief): string {
  const parts: string[] = [];
  if (brief.artStyle.referenceDescriptor) parts.push(brief.artStyle.referenceDescriptor);
  parts.push('full-body character portrait, transparent background');
  if (brief.world.tone.mood) parts.push(`mood: ${brief.world.tone.mood}`);
  return parts.join(', ');
}

function buildCharacterDescription(li: LoveInterestCard): string {
  const lines: string[] = [];
  lines.push(`${li.name}, ${li.age} years old`);
  if (li.roleInWorld) lines.push(`role: ${li.roleInWorld}`);

  const appearanceBits = [
    li.appearance.hair && `hair: ${li.appearance.hair}`,
    li.appearance.build && `build: ${li.appearance.build}`,
    li.appearance.signatureItem && `wears ${li.appearance.signatureItem}`,
    li.appearance.freeform,
  ].filter(Boolean);
  if (appearanceBits.length) lines.push(`appearance: ${appearanceBits.join(', ')}`);

  if (li.personality.traits.length) lines.push(`personality: ${li.personality.traits.join(', ')}`);
  if (li.speechPattern) lines.push(`demeanor: ${li.speechPattern}`);

  return lines.join('\n');
}

function buildStoryContext(brief: Brief, outline: OutlinePlan | null): string {
  const lines: string[] = [];
  if (outline?.title) lines.push(`Story: ${outline.title}`);
  if (outline?.logline) lines.push(`Logline: ${outline.logline}`);
  lines.push(`Setting: ${brief.world.setting.era}, ${brief.world.setting.place}, ${brief.world.setting.specifics}`);
  return lines.join('\n');
}

export function useBulkCharacterGeneration() {
  const [status, setStatus] = useState<CharacterBulkStatus>({ state: 'idle' });
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const start = useCallback(async (brief: Brief, outline: OutlinePlan | null) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;

    const existing = useNarrativeStore.getState().characters;
    const queue: LoveInterestCard[] = brief.loveInterests.filter(
      li => !existing[li.id] || existing[li.id].status === 'failed' || existing[li.id].status === 'pending',
    );

    const total = queue.length;
    let completed = 0;
    let inFlight = 0;
    const failures: CharacterBulkFailure[] = [];

    if (total === 0) {
      setStatus({ state: 'done', total: 0, completed: 0, failures: [], cancelled: false });
      runningRef.current = false;
      return;
    }

    const masterPrompt = buildMasterPrompt(brief);
    const storyContext = buildStoryContext(brief, outline);

    const publish = () => {
      setStatus({
        state: 'running',
        total,
        completed,
        inFlight,
        remaining: queue.length,
        failures: failures.slice(),
        cancelled: cancelledRef.current,
      });
    };

    const setStore = useNarrativeStore.getState().setCharacter;

    const processOne = async (li: LoveInterestCard): Promise<void> => {
      inFlight++;
      setStore(li.id, { status: 'pending' });
      publish();
      try {
        const characterDescription = buildCharacterDescription(li);
        const { data, error } = await generateCharacter({
          body: {
            masterPrompt,
            storyMasterPrompt: storyContext || undefined,
            characterDescription,
            poses: [...EMOTION_POSES],
          },
        });
        if (error || !data) {
          throw new Error('не удалось запустить генерацию');
        }
        const batchId = data.batchId;
        setStore(li.id, { status: 'generating', batchId });

        const result = await pollUntilAllDone(batchId);
        setStore(li.id, { status: 'done', ...result });
        completed++;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        failures.push({ liId: li.id, error });
        setStore(li.id, { status: 'failed', error });
      } finally {
        inFlight--;
        publish();
      }
    };

    const worker = async () => {
      while (queue.length > 0 && !cancelledRef.current) {
        const item = queue.shift()!;
        await processOne(item);
      }
    };

    publish();
    const workers: Promise<void>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
    await Promise.all(workers);

    setStatus({
      state: 'done',
      total,
      completed,
      failures,
      cancelled: cancelledRef.current,
    });
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

async function pollUntilAllDone(
  batchId: string,
): Promise<{ idleFilename: string; poseFilenames: Record<string, string> }> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('timeout: character-batch не завершился за 6 минут');
    }
    await sleep(POLL_INTERVAL_MS);
    const { data, error } = await getBatchStatus({ path: { batchId } });
    if (error || !data) throw new Error('character-batch не найден на сервере');
    const s = data as BatchStatus;

    if (s.done) {
      const idleItem = s.completed.find(c => c.id === 'idle') ?? s.completed[0];
      if (!idleItem?.file) {
        const idleFail = s.failed.find(f => f.id === 'idle');
        throw new Error(idleFail?.error ?? 'idle-поза не сгенерирована');
      }

      const poseFilenames: Record<string, string> = {};
      for (const c of s.completed) {
        if (c.id !== 'idle') poseFilenames[c.id] = c.file;
      }

      if (s.failed.length > 0) {
        const failedPoses = s.failed.filter(f => f.id !== 'idle').map(f => f.id);
        if (failedPoses.length) {
          console.warn(`[character-gen] позы не удались: ${failedPoses.join(', ')}`);
        }
      }

      return { idleFilename: idleItem.file, poseFilenames };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
