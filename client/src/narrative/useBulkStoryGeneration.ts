import { useCallback, useRef, useState } from 'react';
import {
  generateNarrationWeb,
  generateDialogueVariant,
  generateAnchorBeat,
  getBatchStatus,
  type BatchStatus,
} from '@root/text_gen/generated_client';
import type {
  AnchorBeat,
  Brief,
  StoryOutlinePlan,
  NarrationWeb,
  DialogueVariant,
  DialogueVariantBracket,
} from './types';
import {
  parseNarrationWeb,
  validateNarrationWeb,
  parseDialogueVariant,
  parseAnchorBeat,
  validateAnchorBeat,
} from './types';
import { buildNarrationWebRequestPayload } from './buildNarrationWebRequest';
import { buildDialogueVariantRequestPayload } from './buildDialogueVariantRequest';
import { buildAnchorBeatRequestPayload } from './buildAnchorBeatRequest';
import { topoOrderAnchors, outgoingOf } from './anchorOrder';
import { useNarrativeStore } from './narrativeStore';

const CONCURRENCY = 3;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;
const BRACKETS: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];

export type BulkStoryFailure = { key: string; error: string };

export type BulkStoryPhase = 'anchor_beats' | 'narration_webs' | 'dialogue_variants';

export type BulkStoryGenStatus =
  | { state: 'idle' }
  | {
      state: 'running';
      phase: BulkStoryPhase;
      total: number;
      completed: number;
      inFlight: number;
      failures: BulkStoryFailure[];
      cancelled: boolean;
    }
  | {
      state: 'done';
      beatsGenerated: number;
      websGenerated: number;
      variantsGenerated: number;
      failures: BulkStoryFailure[];
      cancelled: boolean;
    };

export function useBulkStoryGeneration() {
  const [status, setStatus] = useState<BulkStoryGenStatus>({ state: 'idle' });
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const start = useCallback(async (brief: Brief, outline: StoryOutlinePlan) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;

    const store = useNarrativeStore.getState();
    const failures: BulkStoryFailure[] = [];

    // Phase 0: anchor beat scenes — последовательно в топо-порядке, потому
    // что каждой сцене нужны beatText-ы предков как контекст.
    const beatAnchors = topoOrderAnchors(outline);
    let beatsGenerated = 0;
    const beatTotal = beatAnchors.filter(a => !store.anchorBeats[a.id]).length;

    const publishBeats = (inFlight: number) => {
      setStatus({
        state: 'running',
        phase: 'anchor_beats',
        total: beatTotal,
        completed: beatsGenerated,
        inFlight,
        failures: failures.slice(),
        cancelled: cancelledRef.current,
      });
    };

    publishBeats(0);

    for (const anchor of beatAnchors) {
      if (cancelledRef.current) break;
      if (useNarrativeStore.getState().anchorBeats[anchor.id]) continue;
      publishBeats(1);
      try {
        const outgoingIds = outgoingOf(outline, anchor.id);
        let best: { beat: AnchorBeat; errorCount: number; errors: string[] } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const basePayload = buildAnchorBeatRequestPayload(
            brief,
            outline,
            anchor,
            useNarrativeStore.getState().anchorBeats,
          );
          type AnchorBeatPayload = typeof basePayload & {
            previousAttempt?: AnchorBeat;
            previousIssues?: string[];
          };
          const payload: AnchorBeatPayload =
            attempt === 0 || !best
              ? basePayload
              : { ...basePayload, previousAttempt: best.beat, previousIssues: best.errors };
          const { data, error } = await generateAnchorBeat({ body: payload });
          if (error || !data) throw new Error('не удалось запустить генерацию beat-сцены');
          const beat = await pollBatchResult(data.batchId, parseAnchorBeat);
          const issues = validateAnchorBeat(beat, anchor.id, outgoingIds);
          const errors = issues
            .filter(i => i.severity === 'error')
            .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
          if (!best || errors.length < best.errorCount) {
            best = { beat, errorCount: errors.length, errors };
          }
          if (errors.length === 0) break;
        }
        // Сохраняем лучшую попытку: конверсия умеет жить с частичным битом
        // (fallback на summary/`→`-подписи), а дыра в кэше хуже.
        useNarrativeStore.getState().setAnchorBeat(anchor.id, best!.beat);
        beatsGenerated++;
        if (best!.errorCount > 0) {
          failures.push({
            key: `beat:${anchor.id}`,
            error: `сохранено с ${best!.errorCount} ошибками валидации: ${best!.errors.slice(0, 2).join('; ')}`,
          });
        }
      } catch (e) {
        failures.push({ key: `beat:${anchor.id}`, error: e instanceof Error ? e.message : String(e) });
      }
      publishBeats(0);
    }

    if (cancelledRef.current) {
      setStatus({ state: 'done', beatsGenerated, websGenerated: 0, variantsGenerated: 0, failures, cancelled: true });
      runningRef.current = false;
      return;
    }

    // Phase 1: narration webs
    const webQueue = outline.anchorEdges
      .filter(e => !store.narrationWebs[`${e.from}->${e.to}`])
      .map(e => ({ fromId: e.from, toId: e.to }));

    let webCompleted = 0;
    let webInFlight = 0;
    const webTotal = webQueue.length;

    const publishWebs = () => {
      setStatus({
        state: 'running',
        phase: 'narration_webs',
        total: webTotal,
        completed: webCompleted,
        inFlight: webInFlight,
        failures: failures.slice(),
        cancelled: cancelledRef.current,
      });
    };

    publishWebs();

    const processWeb = async (item: { fromId: string; toId: string }) => {
      webInFlight++;
      publishWebs();
      try {
        const fromBeatText = useNarrativeStore.getState().anchorBeats[item.fromId]?.beatText;
        const basePayload = {
          ...buildNarrationWebRequestPayload(brief, outline, item.fromId, item.toId),
          ...(fromBeatText ? { fromAnchorBeatText: fromBeatText } : {}),
        };
        const availableLIIds = basePayload.availableLIs.map(li => li.liId);

        // Генерация с одним retry-with-feedback при ошибках валидации.
        let best: { web: NarrationWeb; errorCount: number; errors: string[] } | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          const payload =
            attempt === 0 || !best
              ? basePayload
              : {
                  ...basePayload,
                  previousAttempt: best.web,
                  previousIssues: best.errors,
                };
          const { data, error } = await generateNarrationWeb({ body: payload });
          if (error || !data) throw new Error('не удалось запустить генерацию narration web');
          const web = await pollNarrationWeb(data.batchId);
          const issues = validateNarrationWeb(web, availableLIIds);
          const errors = issues
            .filter(i => i.severity === 'error')
            .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
          if (!best || errors.length < best.errorCount) {
            best = { web, errorCount: errors.length, errors };
          }
          if (errors.length === 0) break;
        }

        // Сохраняем лучшую попытку в любом случае (частично валидная паутина
        // лучше дыры в графе), но фейл с ошибками показываем в UI.
        useNarrativeStore.getState().setNarrationWeb(item.fromId, item.toId, best!.web);
        webCompleted++;
        if (best!.errorCount > 0) {
          failures.push({
            key: `web:${item.fromId}->${item.toId}`,
            error: `сохранено с ${best!.errorCount} ошибками валидации: ${best!.errors.slice(0, 2).join('; ')}`,
          });
        }
      } catch (e) {
        failures.push({ key: `web:${item.fromId}->${item.toId}`, error: e instanceof Error ? e.message : String(e) });
      } finally {
        webInFlight--;
        publishWebs();
      }
    };

    const webWorker = async () => {
      while (webQueue.length > 0 && !cancelledRef.current) {
        await processWeb(webQueue.shift()!);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => webWorker()));

    if (cancelledRef.current) {
      setStatus({
        state: 'done',
        beatsGenerated,
        websGenerated: webCompleted,
        variantsGenerated: 0,
        failures,
        cancelled: true,
      });
      runningRef.current = false;
      return;
    }

    // Phase 2: dialogue variants
    const allWebs = useNarrativeStore.getState().narrationWebs;
    // Варианты хранятся per (anchor, LI), а паутин у якоря может быть
    // несколько — дедупим задачи по тому же ключу, иначе платим дважды.
    const taskByKey = new Map<string, { anchorId: string; liId: string; anchor: typeof outline.anchors[0] }>();

    for (const edge of outline.anchorEdges) {
      const web = allWebs[`${edge.from}->${edge.to}`];
      if (!web) continue;
      const anchor = outline.anchors.find(a => a.id === edge.from);
      if (!anchor) continue;

      const encounterLIs = new Set<string>();
      for (const scene of web.scenes) {
        for (const choice of scene.choices) {
          if (choice.encounterTrigger) encounterLIs.add(choice.encounterTrigger);
        }
      }

      for (const liId of encounterLIs) {
        const key = `${anchor.id}:${liId}`;
        if (taskByKey.has(key)) continue;
        const existingVariants = useNarrativeStore.getState().getDialogueVariants(anchor.id, liId);
        if (existingVariants && existingVariants.length === 3) continue;
        taskByKey.set(key, { anchorId: anchor.id, liId, anchor });
      }
    }
    const encounterTasks = [...taskByKey.values()];

    let varCompleted = 0;
    let varInFlight = 0;
    const varTotal = encounterTasks.length * 3;

    const publishVars = () => {
      setStatus({
        state: 'running',
        phase: 'dialogue_variants',
        total: varTotal,
        completed: varCompleted,
        inFlight: varInFlight,
        failures: failures.slice(),
        cancelled: cancelledRef.current,
      });
    };

    publishVars();

    const processEncounter = async (task: typeof encounterTasks[0]) => {
      const li = brief.loveInterests.find(l => l.id === task.liId);
      if (!li) {
        failures.push({ key: `var:${task.anchorId}:${task.liId}`, error: `LI ${task.liId} не найден в брифе` });
        return;
      }

      const variants: DialogueVariant[] = [];
      for (const bracket of BRACKETS) {
        if (cancelledRef.current) break;
        varInFlight++;
        publishVars();
        try {
          const payload = buildDialogueVariantRequestPayload(brief, li, task.anchor, bracket, task.anchor.summary);
          const { data, error } = await generateDialogueVariant({ body: payload });
          if (error || !data) throw new Error(`не удалось запустить генерацию для bracket=${bracket}`);
          const variant = await pollDialogueVariant(data.batchId);
          variants.push(variant);
          varCompleted++;
        } catch (e) {
          failures.push({
            key: `var:${task.anchorId}:${task.liId}:${bracket}`,
            error: e instanceof Error ? e.message : String(e),
          });
        } finally {
          varInFlight--;
          publishVars();
        }
      }

      if (variants.length > 0) {
        useNarrativeStore.getState().setDialogueVariants(task.anchorId, task.liId, variants);
      }
    };

    const varWorker = async () => {
      while (encounterTasks.length > 0 && !cancelledRef.current) {
        await processEncounter(encounterTasks.shift()!);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => varWorker()));

    setStatus({
      state: 'done',
      beatsGenerated,
      websGenerated: webCompleted,
      variantsGenerated: varCompleted,
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

async function pollBatchResult<T>(batchId: string, parse: (raw: string) => T): Promise<T> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error('timeout');
    await sleep(POLL_INTERVAL_MS);
    const { data, error } = await getBatchStatus({ path: { batchId } });
    if (error || !data) throw new Error('батч не найден');
    const s = data as BatchStatus;
    if (s.failed.length > 0) throw new Error(s.failed[0]?.error ?? 'ошибка генерации');
    if (s.done) {
      const raw = s.completed[0]?.result;
      if (!raw) throw new Error('пустой результат');
      return parse(raw);
    }
  }
}

function pollNarrationWeb(batchId: string): Promise<NarrationWeb> {
  return pollBatchResult(batchId, parseNarrationWeb);
}

function pollDialogueVariant(batchId: string): Promise<DialogueVariant> {
  return pollBatchResult(batchId, parseDialogueVariant);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
