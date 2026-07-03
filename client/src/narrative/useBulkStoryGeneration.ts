import { useCallback, useRef, useState } from 'react';
import {
  generateDialogueVariant,
  generateAnchorBeat,
  generateBeatPlan,
  generateWorldModel,
  generateEnding,
  getBatchStatus,
  type BatchStatus,
} from '@root/text_gen/generated_client';
import type {
  AnchorBeat,
  BeatPlan,
  Brief,
  WorldModel,
  EndingKind,
  EndingVariant,
  StoryOutlinePlan,
  DialogueVariant,
  DialogueVariantBracket,
} from './types';
import {
  parseDialogueVariant,
  parseAnchorBeat,
  validateAnchorBeat,
  parseBeatPlan,
  validateDialogueVariant,
  parseEndingVariant,
  validateEndingVariant,
  endingKey,
  parseWorldModel,
  validateWorldModel,
} from './types';
import { validateBeatPlan } from './validateBeatPlan';
import { buildBeatPlanRequestPayload, computeEncounterSlots } from './buildBeatPlanRequest';
import { buildDialogueVariantRequestPayload, buildEncounterContext } from './buildDialogueVariantRequest';
import { buildAnchorBeatRequestPayload } from './buildAnchorBeatRequest';
import { buildEndingRequestPayload } from './buildEndingRequest';
import { topoOrderAnchors, outgoingOf } from './anchorOrder';
import { useNarrativeStore } from './narrativeStore';

const CONCURRENCY = 3;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;
const BRACKETS: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];

export type BulkStoryFailure = { key: string; error: string };

export type BulkStoryPhase = 'world_model' | 'beat_plan' | 'anchor_beats' | 'dialogue_variants' | 'endings';

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
      variantsGenerated: number;
      endingsGenerated: number;
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
    // Имена и id каста — валидатор labels переходов запрещает упоминать LI.
    const liNames = brief.loveInterests.flatMap(li => [li.name, li.id]).filter(Boolean);

    // Phase −2: world model — реестр локаций со связностью. Один вызов;
    // при окончательном фейле пайплайн продолжает БЕЗ мира (деградация:
    // пространственные проверки паутин выключены, всё работает как раньше).
    {
      const cachedWorld = store.worldModel;
      const cachedWorldErrors = cachedWorld
        ? validateWorldModel(cachedWorld, outline)
            .filter(i => i.severity === 'error')
            .map(i => `[${i.severity}] ${i.scope}: ${i.message}`)
        : [];
      if (!cachedWorld || cachedWorldErrors.length > 0) {
        setStatus({
          state: 'running',
          phase: 'world_model',
          total: 1,
          completed: 0,
          inFlight: 1,
          failures: failures.slice(),
          cancelled: cancelledRef.current,
        });
        try {
          const basePayload = { brief, outline };
          let best: { world: WorldModel; errorCount: number; errors: string[] } | null =
            cachedWorld && cachedWorldErrors.length > 0
              ? { world: cachedWorld, errorCount: cachedWorldErrors.length, errors: cachedWorldErrors }
              : null;
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              type WorldPayload = typeof basePayload & {
                previousAttempt?: WorldModel;
                previousIssues?: string[];
              };
              const payload: WorldPayload = !best
                ? basePayload
                : { ...basePayload, previousAttempt: best.world, previousIssues: best.errors };
              const { data, error } = await generateWorldModel({ body: payload });
              if (error || !data) throw new Error('не удалось запустить построение мира');
              const world = await pollBatchResult(data.batchId, parseWorldModel);
              const issues = validateWorldModel(world, outline);
              const errors = issues
                .filter(i => i.severity === 'error')
                .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
              if (!best || errors.length < best.errorCount) {
                best = { world, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (best && best.errorCount === 0) {
            useNarrativeStore.getState().setWorldModel(best.world);
          } else if (!best && lastAttemptError) {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          } else {
            failures.push({
              key: 'worldModel',
              error: `модель мира не прошла валидацию (${
                best?.errorCount ?? '?'
              } ошибок) — генерация продолжится без неё`,
            });
          }
        } catch (e) {
          failures.push({ key: 'worldModel', error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
    const worldModel = useNarrativeStore.getState().worldModel;

    // Phase −1: beat plan — один вызов, планирует биты отношений по встречам.
    // При окончательном фейле пайплайн продолжает БЕЗ плана (деградация).
    // Кэшированный план перепроверяется против ТЕКУЩЕГО outline: протухшая
    // пара (якорь, LI) иначе замерзает в кэше и вечно плодит задачи-фантомы.
    const cachedPlanValid = (() => {
      if (!store.beatPlan) return false;
      const slots = computeEncounterSlots(outline);
      return validateBeatPlan(store.beatPlan, outline, brief, slots).filter(i => i.severity === 'error').length === 0;
    })();
    if (store.beatPlan && !cachedPlanValid) {
      useNarrativeStore.getState().setBeatPlan(null);
    }
    if (!cachedPlanValid) {
      setStatus({
        state: 'running',
        phase: 'beat_plan',
        total: 1,
        completed: 0,
        inFlight: 1,
        failures: failures.slice(),
        cancelled: cancelledRef.current,
      });
      try {
        const slots = computeEncounterSlots(outline);
        const basePayload = buildBeatPlanRequestPayload(brief, outline);
        let best: { plan: BeatPlan; errorCount: number; errors: string[] } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          type BeatPlanPayload = typeof basePayload & {
            previousAttempt?: BeatPlan;
            previousIssues?: string[];
          };
          const payload: BeatPlanPayload =
            attempt === 0 || !best
              ? basePayload
              : { ...basePayload, previousAttempt: best.plan, previousIssues: best.errors };
          const { data, error } = await generateBeatPlan({ body: payload });
          if (error || !data) throw new Error('не удалось запустить планирование битов');
          const plan = await pollBatchResult(data.batchId, parseBeatPlan);
          const issues = validateBeatPlan(plan, outline, brief, slots);
          const errors = issues
            .filter(i => i.severity === 'error')
            .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
          if (!best || errors.length < best.errorCount) {
            best = { plan, errorCount: errors.length, errors };
          }
          if (errors.length === 0) break;
        }
        if (best && best.errorCount === 0) {
          useNarrativeStore.getState().setBeatPlan(best.plan);
        } else {
          failures.push({
            key: 'beatPlan',
            error: `план битов не прошёл валидацию (${
              best?.errorCount ?? '?'
            } ошибок) — генерация продолжится без плана`,
          });
        }
      } catch (e) {
        failures.push({ key: 'beatPlan', error: e instanceof Error ? e.message : String(e) });
      }
    }
    const beatPlan = useNarrativeStore.getState().beatPlan;
    const plannedLIsByAnchor = new Map<string, string[]>();
    if (beatPlan) {
      for (const enc of beatPlan.encounters) {
        const list = plannedLIsByAnchor.get(enc.anchorId) ?? [];
        if (!list.includes(enc.liId)) list.push(enc.liId);
        plannedLIsByAnchor.set(enc.anchorId, list);
      }
    }

    if (cancelledRef.current) {
      setStatus({
        state: 'done',
        beatsGenerated: 0,
        variantsGenerated: 0,
        endingsGenerated: 0,
        failures,
        cancelled: true,
      });
      runningRef.current = false;
      return;
    }

    // Phase 0: anchor beat scenes — последовательно в топо-порядке, потому
    // что каждой сцене нужны beatText-ы предков как контекст.
    const beatAnchors = topoOrderAnchors(outline);
    let beatsGenerated = 0;
    // Кэшированный бит пропускается, только если он валиден по ТЕКУЩИМ
    // правилам — иначе регенерация с кэшем как previousAttempt (self-heal).
    const beatCacheErrors = (anchorId: string): string[] => {
      const cached = useNarrativeStore.getState().anchorBeats[anchorId];
      if (!cached) return [];
      const issues = validateAnchorBeat(cached, anchorId, outgoingOf(outline, anchorId), liNames);
      return issues.filter(i => i.severity === 'error').map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
    };
    const beatNeedsWork = (anchorId: string): boolean =>
      !store.anchorBeats[anchorId] || beatCacheErrors(anchorId).length > 0;
    const beatTotal = beatAnchors.filter(a => beatNeedsWork(a.id)).length;

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
      if (!beatNeedsWork(anchor.id)) continue;
      publishBeats(1);
      try {
        const outgoingIds = outgoingOf(outline, anchor.id);
        let best: { beat: AnchorBeat; errorCount: number; errors: string[] } | null = null;
        const cachedBeat = useNarrativeStore.getState().anchorBeats[anchor.id];
        if (cachedBeat) {
          const cachedErrors = beatCacheErrors(anchor.id);
          if (cachedErrors.length > 0) {
            best = { beat: cachedBeat, errorCount: cachedErrors.length, errors: cachedErrors };
          }
        }
        let lastAttemptError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const basePayload = buildAnchorBeatRequestPayload(
              brief,
              outline,
              anchor,
              useNarrativeStore.getState().anchorBeats,
              worldModel,
            );
            type AnchorBeatPayload = typeof basePayload & {
              previousAttempt?: AnchorBeat;
              previousIssues?: string[];
            };
            const payload: AnchorBeatPayload = !best
              ? basePayload
              : { ...basePayload, previousAttempt: best.beat, previousIssues: best.errors };
            const { data, error } = await generateAnchorBeat({ body: payload });
            if (error || !data) throw new Error('не удалось запустить генерацию beat-сцены');
            const beat = await pollBatchResult(data.batchId, parseAnchorBeat);
            const issues = validateAnchorBeat(beat, anchor.id, outgoingIds, liNames);
            const errors = issues
              .filter(i => i.severity === 'error')
              .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
            if (!best || errors.length < best.errorCount) {
              best = { beat, errorCount: errors.length, errors };
            }
            if (errors.length === 0) break;
          } catch (attemptErr) {
            lastAttemptError = attemptErr;
          }
        }
        if (!best) {
          throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
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
      setStatus({
        state: 'done',
        beatsGenerated,
        variantsGenerated: 0,
        endingsGenerated: 0,
        failures,
        cancelled: true,
      });
      runningRef.current = false;
      return;
    }

    // Narration webs выпилены: игра компилируется как стейт-машина по графу
    // локаций (compileWorldGame), маршруты и встречи детерминированы —
    // LLM-паутины между якорями больше не генерируются и не читаются.

    // Phase 1: dialogue variants
    // Источник задач — план битов + пары (якорь, LI из availableLIs):
    // ровно те встречи, которые компилятор мира подключает в игру.
    const taskByKey = new Map<string, { anchorId: string; liId: string; anchor: typeof outline.anchors[0] }>();

    const variantErrors = (v: DialogueVariant): string[] =>
      validateDialogueVariant(v)
        .filter(i => i.severity === 'error')
        .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);

    const enqueueTask = (anchorId: string, liId: string) => {
      const key = `${anchorId}:${liId}`;
      if (taskByKey.has(key)) return;
      const anchor = outline.anchors.find(a => a.id === anchorId);
      if (!anchor) return;
      const existingVariants = useNarrativeStore.getState().getDialogueVariants(anchorId, liId);
      // Пропускаем только полный И валидный по текущим правилам набор —
      // невалидные брекеты перегенерируются точечно (self-heal).
      if (
        existingVariants &&
        existingVariants.length === 3 &&
        existingVariants.every(v => variantErrors(v).length === 0)
      ) {
        return;
      }
      taskByKey.set(key, { anchorId, liId, anchor });
    };

    if (beatPlan) {
      for (const enc of beatPlan.encounters) enqueueTask(enc.anchorId, enc.liId);
    }
    // Компилятор мира подключает встречу для каждой пары (якорь, LI из
    // availableLIs) — диалоги нужны ровно этим парам. Никаких сканов
    // сгенерированных артефактов: только outline как источник истины.
    for (const anchor of outline.anchors) {
      for (const liId of anchor.availableLIs) enqueueTask(anchor.id, liId);
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

      const storeNow = useNarrativeStore.getState();
      const encounterContext = buildEncounterContext(storeNow.beatPlan, outline, storeNow.anchorBeats, li, task.anchor);
      // recentEvents: сцена-событие якоря, которую игрок только что видел,
      // с fallback на авторский summary для старых кэшей.
      const recentEvents = storeNow.anchorBeats[task.anchorId]?.beatText ?? task.anchor.summary;

      const cachedVariants = useNarrativeStore.getState().getDialogueVariants(task.anchorId, task.liId) ?? [];
      const variants: DialogueVariant[] = [];
      for (const bracket of BRACKETS) {
        if (cancelledRef.current) break;
        // Валидный кэшированный брекет не трогаем — деньги уходят только
        // на невалидные и отсутствующие.
        const cachedForBracket = cachedVariants.find(v => v.bracket === bracket);
        if (cachedForBracket && variantErrors(cachedForBracket).length === 0) {
          variants.push(cachedForBracket);
          continue;
        }
        varInFlight++;
        publishVars();
        try {
          const dialogueLoc = (() => {
            if (!worldModel) return undefined;
            const locId = worldModel.anchorLocations[task.anchorId];
            const loc = worldModel.locations.find(l => l.id === locId);
            return loc
              ? { name: loc.name, description: loc.description, pointsOfInterest: loc.pointsOfInterest }
              : undefined;
          })();
          const basePayload = buildDialogueVariantRequestPayload(
            brief,
            li,
            task.anchor,
            bracket,
            recentEvents,
            encounterContext,
            dialogueLoc,
          );
          // Retry при ошибках валидации; падение попытки изолировано.
          // Невалидный кэш сидирует best — его ошибки уходят фидбеком.
          let best: { variant: DialogueVariant; errorCount: number; errors: string[] } | null = null;
          if (cachedForBracket) {
            const cachedErrs = variantErrors(cachedForBracket);
            if (cachedErrs.length > 0) {
              best = { variant: cachedForBracket, errorCount: cachedErrs.length, errors: cachedErrs };
            }
          }
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              type DialoguePayload = typeof basePayload & {
                previousAttempt?: DialogueVariant;
                previousIssues?: string[];
              };
              const payload: DialoguePayload = !best
                ? basePayload
                : { ...basePayload, previousAttempt: best.variant, previousIssues: best.errors };
              const { data, error } = await generateDialogueVariant({ body: payload });
              if (error || !data) throw new Error(`не удалось запустить генерацию для bracket=${bracket}`);
              const variant = await pollDialogueVariant(data.batchId);
              const issues = validateDialogueVariant(variant);
              const errors = issues
                .filter(i => i.severity === 'error')
                .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
              if (!best || errors.length < best.errorCount) {
                best = { variant, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              lastAttemptError = attemptErr;
            }
          }
          if (!best) {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          }
          variants.push(best!.variant);
          varCompleted++;
          if (best!.errorCount > 0) {
            failures.push({
              key: `var:${task.anchorId}:${task.liId}:${bracket}`,
              error: `сохранено с ошибками валидации: ${best!.errors.slice(0, 2).join('; ')}`,
            });
          }
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

    // Phase 3: endings — good per-LI + общие normal/bad (по endingsProfile).
    let endingsGenerated = 0;
    if (!cancelledRef.current) {
      const endingTasks: { kind: EndingKind; li: typeof brief.loveInterests[0] | null }[] = [];
      if (brief.endingsProfile.includes('good')) {
        for (const li of brief.loveInterests) endingTasks.push({ kind: 'good', li });
      }
      if (brief.endingsProfile.includes('normal')) endingTasks.push({ kind: 'normal', li: null });
      if (brief.endingsProfile.includes('bad')) endingTasks.push({ kind: 'bad', li: null });

      const pendingTasks = endingTasks.filter(t => !useNarrativeStore.getState().endings[endingKey(t.kind, t.li?.id)]);
      let endInFlight = 0;
      const endTotal = pendingTasks.length;
      const publishEndings = () => {
        setStatus({
          state: 'running',
          phase: 'endings',
          total: endTotal,
          completed: endingsGenerated,
          inFlight: endInFlight,
          failures: failures.slice(),
          cancelled: cancelledRef.current,
        });
      };
      publishEndings();

      const processEndingTask = async (task: typeof endingTasks[0]) => {
        endInFlight++;
        publishEndings();
        const key = endingKey(task.kind, task.li?.id);
        try {
          const storeNow = useNarrativeStore.getState();
          const basePayload = buildEndingRequestPayload(
            brief,
            outline,
            task.kind,
            task.li,
            storeNow.beatPlan,
            storeNow.anchorBeats,
          );
          let best: { ending: EndingVariant; errorCount: number; errors: string[] } | null = null;
          let lastAttemptError: unknown = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              type EndingPayload = typeof basePayload & {
                previousAttempt?: EndingVariant;
                previousIssues?: string[];
              };
              const payload: EndingPayload = !best
                ? basePayload
                : { ...basePayload, previousAttempt: best.ending, previousIssues: best.errors };
              const { data, error } = await generateEnding({ body: payload });
              if (error || !data) throw new Error(`не удалось запустить генерацию концовки ${key}`);
              const ending = await pollBatchResult(data.batchId, parseEndingVariant);
              const issues = validateEndingVariant(ending, task.kind);
              const errors = issues
                .filter(i => i.severity === 'error')
                .map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
              if (!best || errors.length < best.errorCount) {
                best = { ending, errorCount: errors.length, errors };
              }
              if (errors.length === 0) break;
            } catch (attemptErr) {
              // invalid JSON / timeout отдельной попытки не убивает остальные
              lastAttemptError = attemptErr;
            }
          }
          if (!best) {
            throw lastAttemptError instanceof Error ? lastAttemptError : new Error(String(lastAttemptError));
          }
          // liId генератора может отсутствовать/врать — фиксируем свой.
          const normalized: EndingVariant = {
            ...best!.ending,
            kind: task.kind,
            liId: task.kind === 'good' ? task.li?.id ?? null : null,
          };
          useNarrativeStore.getState().setEnding(key, normalized);
          endingsGenerated++;
          if (best!.errorCount > 0) {
            failures.push({
              key: `ending:${key}`,
              error: `сохранено с ошибками валидации: ${best!.errors.slice(0, 2).join('; ')}`,
            });
          }
        } catch (e) {
          failures.push({ key: `ending:${key}`, error: e instanceof Error ? e.message : String(e) });
        } finally {
          endInFlight--;
          publishEndings();
        }
      };

      const endQueue = [...pendingTasks];
      const endWorker = async () => {
        while (endQueue.length > 0 && !cancelledRef.current) {
          await processEndingTask(endQueue.shift()!);
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, () => endWorker()));
    }

    setStatus({
      state: 'done',
      beatsGenerated,
      variantsGenerated: varCompleted,
      endingsGenerated,
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

function pollDialogueVariant(batchId: string): Promise<DialogueVariant> {
  return pollBatchResult(batchId, parseDialogueVariant);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
