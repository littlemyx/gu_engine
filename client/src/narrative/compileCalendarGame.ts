import type { AnchorBeat, Brief, DialogueVariant, EndingVariant, WorldLocation, WorldModel } from './types';
import { DEFAULT_LOCATION_MOOD, endingKey, isLocationMood, isSpecialAmbientKind } from './types';
import type { CharacterGenState, ImageGenState } from './narrativeStore';
import type { Calendar, CharacterSchedule, SpineBeat, SpinePlan } from './calendarTypes';
import { guardFlags } from './validateSpine';
import type { Guard } from './events';
import type { WorldAudioInput, WorldCompileStats } from './compileWorldGame';
import type {
  GameProjectFile,
  GameSceneEdge,
  GameSceneGraph,
  GameSceneNode,
  GameSceneOutput,
  GameSpriteEntry,
  GameStateCondition,
  GameWorldManifest,
} from './convertToGameProject';
import {
  BRACKET_WIRE_ORDER,
  assignPositions,
  bracketCondition,
  buildStoryStateSchema,
  escapeNL,
  imageUrlFor,
  renderDraftSceneText,
} from './convertToGameProject';
import { ARCHETYPES } from './archetypes';
import { pickCharacterEmotion, resolveEmotionToSpriteUrl } from './emotionResolver';
import { audioUrlFor, buildSceneAudioProfile, resolveSfxUrl, selectedTrackFile } from './audioResolver';

/**
 * Календарный компилятор (Phase 2 плана docs/plans/calendar-branching.md).
 *
 * Шаблон — compileWorldGame.ts (хабы/enter-роутеры/ending-router/манифест),
 * но стрела времени становится ЧИТАЕМОЙ переменной slot:
 *
 *   1. ПОЗИЦИЯ — hub_<loc> на каждую локацию мира; перемещение БЕСПЛАТНО
 *      (slot не двигает), плюс кнопка «Подождать» (slot+1) на каждом хабе.
 *   2. СТРЕЛА ВРЕМЕНИ — переменная slot (день × часть дня). Её двигает
 *      потребление контента: бит хребта = slot+1, встреча = slot+1, ожидание
 *      = slot+1. Условия рёбер впервые ЧИТАЮТ время: окно бита компилируется
 *      в [{path:'slot',gte},{path:'slot',lte}].
 *   3. ХРЕБЕТ — SpineBeat играется enter-роутером локации, когда «созрел»:
 *      slot в окне, guard-флаги выполнены, бит ещё не случился (beat[<id>]).
 *      Флаги guard-ов — численные 0/1-переменные flag[<f>] (движок оценивает
 *      условия только по state, флаговый механизм flagSet рёбра не гейтит).
 *   4. ВСТРЕЧИ — из CharacterSchedule: подряд идущие слоты персонажа в одной
 *      локации схлопываются в один диапазон (run-length), кнопка «Поговорить»
 *      гейтится slot-диапазоном и met-переменной, диалог — bracket-роутер.
 *
 * Движок game/src/engine.ts НЕ меняется; календарь уезжает в
 * settings.calendar для HUD (game/src/calendarState.ts).
 */

export type CalendarCompileStats = WorldCompileStats & {
  slotCount: number;
  /** Битов хребта, доведённых до узлов (locationId найден в мире). */
  beatsWired: number;
};

export type CalendarCompileResult = {
  project: GameProjectFile;
  scenes: GameSceneGraph;
  stats: CalendarCompileStats;
};

const hubId = (locId: string) => `hub_${locId}`;
const enterId = (locId: string) => `enter_${locId}`;
const SLOT_VAR = 'slot';
const beatVar = (beatId: string) => `beat[${beatId}]`;
const flagVar = (flag: string) => `flag[${flag}]`;
/** met-переменная per (LI, начало диапазона слотов) — встреча одноразова. */
const metVar = (liId: string, fromSlot: number) => `met[${liId}].${fromSlot}`;

/** Диегетическая подпись перемещения (копия compileWorldGame). */
function movementLabel(to: WorldLocation, via: string): string {
  const v = via.trim();
  return v ? `Пойти: ${to.name} (${v})` : `Пойти: ${to.name}`;
}

/**
 * Guard → условия движка. v1-контракт LLM плоский (all[flag]); any/not/rel
 * вне скоупа фазы 2 — guardFlags их сплющивает в конъюнкцию флагов
 * (over-approximation, валидатор хребта не пропускает другие формы).
 */
function guardConditions(guard: Guard): GameStateCondition[] {
  return guardFlags(guard).map(f => ({ path: flagVar(f), gte: 1 }));
}

/** Окно слотов бита → численные условия по slot. */
function windowConditions(beat: SpineBeat): GameStateCondition[] {
  return [
    { path: SLOT_VAR, gte: beat.window.fromSlot },
    { path: SLOT_VAR, lte: beat.window.toSlot },
  ];
}

/** Диапазон подряд идущих слотов персонажа в одной локации. */
type ScheduleRun = { liId: string; locId: string; fromSlot: number; toSlot: number };

/** Run-length кодирование расписания: смежные слоты в одной локации → диапазон. */
export function scheduleRuns(schedule: CharacterSchedule, slotCount: number): ScheduleRun[] {
  const runs: ScheduleRun[] = [];
  for (const [liId, slots] of Object.entries(schedule)) {
    let cur: ScheduleRun | null = null;
    for (let s = 0; s < Math.min(slots.length, slotCount); s++) {
      const loc = slots[s];
      if (loc && cur && cur.locId === loc && cur.toSlot === s - 1) {
        cur.toSlot = s;
      } else {
        if (cur) runs.push(cur);
        cur = loc ? { liId, locId: loc, fromSlot: s, toSlot: s } : null;
      }
    }
    if (cur) runs.push(cur);
  }
  return runs;
}

/**
 * Компил-линт роутеров: у каждого router-узла последнее исходящее ребро
 * обязано быть безусловным (страховка ROUTER_DEAD_END — движок берёт первое
 * активное ребро, безусловный fallback гарантирует выход). Возвращает список
 * нарушений; пустой = граф чист. Реиспользуется story-QA фазы 6.
 */
export function lintRouters(scenes: GameSceneGraph): string[] {
  const issues: string[] = [];
  const bySource = new Map<string, GameSceneEdge[]>();
  for (const e of scenes.edges) {
    const list = bySource.get(e.source) ?? [];
    list.push(e);
    bySource.set(e.source, list);
  }
  for (const node of scenes.nodes) {
    if (node.data.sceneType !== 'router') continue;
    const edges = bySource.get(node.id) ?? [];
    if (edges.length === 0) {
      issues.push(`router "${node.id}": нет исходящих рёбер`);
      continue;
    }
    const last = edges[edges.length - 1];
    if (last.condition && last.condition.length > 0) {
      issues.push(`router "${node.id}": последнее ребро условное — риск ROUTER_DEAD_END`);
    }
  }
  return issues;
}

export function compileCalendarGameProject(
  brief: Brief,
  spine: SpinePlan,
  calendar: Calendar,
  schedule: CharacterSchedule,
  worldModel: WorldModel,
  spineBeatProse: Record<string, AnchorBeat> = {},
  unitProse: Record<string, DialogueVariant[]> = {},
  endings: Record<string, EndingVariant> = {},
  images: Record<string, ImageGenState> = {},
  characters: Record<string, CharacterGenState> = {},
  audio: WorldAudioInput = { base: null, moodBeds: {}, specialBeds: {}, byLi: {}, sfx: {} },
): CalendarCompileResult {
  const nodes: GameSceneNode[] = [];
  const edges: GameSceneEdge[] = [];
  const allIds = new Set<string>();
  const stateVars = new Map<string, { range: [number, number]; default: number }>();

  let encountersWired = 0;
  let dialogueSceneCount = 0;
  let endingSceneCount = 0;
  let beatsWired = 0;

  const uniqueId = (base: string): string => {
    let id = base;
    let i = 0;
    while (allIds.has(id)) id = `${base}__${++i}`;
    allIds.add(id);
    return id;
  };

  const locById = new Map(worldModel.locations.map(l => [l.id, l]));
  const bgForLocation = (locId: string): string => imageUrlFor(images[`loc:${locId}`]);
  const liNameById = new Map(brief.loveInterests.map(li => [li.id, li.name]));

  // Adjacency симметризуется (LLM-модель мира часто односторонняя).
  const neighbors = new Map<string, { locationId: string; via: string }[]>();
  const addNeighbor = (a: string, b: string, via: string) => {
    if (!neighbors.has(a)) neighbors.set(a, []);
    if (!neighbors.get(a)!.some(n => n.locationId === b)) neighbors.get(a)!.push({ locationId: b, via });
  };
  for (const l of worldModel.locations) {
    for (const adj of l.adjacent) {
      if (!locById.has(adj.locationId)) continue;
      addNeighbor(l.id, adj.locationId, adj.via);
      addNeighbor(adj.locationId, l.id, adj.via);
    }
  }

  // Биты по локациям; в роутере проверяются по (window.toSlot, id) — самый
  // «горящий» дедлайн первым, тай-брейк детерминирован.
  const wirableBeats = spine.beats.filter(b => locById.has(b.locationId));
  const beatsByLoc = new Map<string, SpineBeat[]>();
  for (const beat of wirableBeats) {
    if (!beatsByLoc.has(beat.locationId)) beatsByLoc.set(beat.locationId, []);
    beatsByLoc.get(beat.locationId)!.push(beat);
  }
  for (const list of beatsByLoc.values()) {
    list.sort((a, b) => a.window.toSlot - b.window.toSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  // ── Переменные состояния ──────────────────────────────────────────────
  // slot: реальная стрела времени, читаемая условиями рёбер. Диапазон до
  // slotCount (не slotCount-1): движок клампит дельты по range, «Подождать»
  // на излёте календаря просто упирается в потолок.
  stateVars.set(SLOT_VAR, { range: [0, calendar.slotCount], default: 0 });
  for (const beat of spine.beats) stateVars.set(beatVar(beat.id), { range: [0, 1], default: 0 });
  // Флаги guard-ов ОБЯЗАНЫ быть численными 0/1-переменными: engine.ts
  // getActiveEdges оценивает условия только по state, не по flags.
  const allFlags = new Set<string>();
  for (const beat of spine.beats) {
    for (const f of beat.establishes) allFlags.add(f);
    for (const o of beat.outcomes ?? []) allFlags.add(o.setsFlag);
    for (const f of guardFlags(beat.guard)) allFlags.add(f);
  }
  for (const e of spine.endings) for (const f of guardFlags(e.guard)) allFlags.add(f);
  for (const f of allFlags) stateVars.set(flagVar(f), { range: [0, 1], default: 0 });

  // Резервируем стабильные id.
  for (const beat of spine.beats) allIds.add(beat.id);
  for (const l of worldModel.locations) {
    allIds.add(hubId(l.id));
    allIds.add(enterId(l.id));
  }

  const finaleBeat = wirableBeats.find(b => b.kind === 'finale') ?? null;
  const hasEndings = Object.keys(endings).length > 0;
  const endingRouterId = hasEndings ? uniqueId('ending_router') : null;

  // ── 1. Узлы битов хребта ──────────────────────────────────────────────
  for (const beat of wirableBeats) {
    beatsWired++;
    const image = bgForLocation(beat.locationId);
    const isFinale = finaleBeat !== null && beat.id === finaleBeat.id;
    // Финал уводит в маршрутизатор концовок, остальные — назад в хаб.
    const exitTarget = isFinale && endingRouterId ? endingRouterId : hubId(beat.locationId);
    // Эффекты выхода: бит случился, его флаги установлены, время двинулось.
    const exitDeltas: Record<string, number> = { [beatVar(beat.id)]: 1, [SLOT_VAR]: 1 };
    for (const f of beat.establishes) exitDeltas[flagVar(f)] = 1;

    const outputs: GameSceneOutput[] = [];
    if (beat.outcomes && beat.outcomes.length > 0) {
      // branchPoint: исходы — выборы игрока, каждый ставит свой спайн-флаг.
      for (const o of beat.outcomes) {
        const outId = uniqueId(`${beat.id}__${o.id}`);
        outputs.push({
          id: outId,
          text: o.label || o.summary || o.id,
          effects: { stateDeltas: { ...exitDeltas, [flagVar(o.setsFlag)]: 1 } },
        });
        edges.push({ id: `e_${outId}`, source: beat.id, sourceHandle: outId, target: exitTarget });
      }
    } else {
      const autoId = uniqueId(`${beat.id}__done`);
      outputs.push({ id: autoId, text: '', effects: { stateDeltas: exitDeltas } });
      edges.push({ id: `e_${autoId}`, source: beat.id, sourceHandle: autoId, target: exitTarget });
    }

    nodes.push({
      id: beat.id,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: {
        label: spineBeatProse[beat.id]?.beatText?.trim() || escapeNL(beat.summary) || `[бит ${beat.id}]`,
        image,
        outputs,
        sceneType: beat.outcomes && beat.outcomes.length > 0 ? 'branch' : 'narration',
      },
    });
  }

  // ── 2. Слой перемещения: enter-роутер + hub на локацию ────────────────
  // Диапазоны встреч по локациям (run-length по расписанию).
  const runsByLoc = new Map<string, ScheduleRun[]>();
  for (const run of scheduleRuns(schedule, calendar.slotCount)) {
    if (!locById.has(run.locId)) continue;
    if (!runsByLoc.has(run.locId)) runsByLoc.set(run.locId, []);
    runsByLoc.get(run.locId)!.push(run);
  }

  for (const loc of worldModel.locations) {
    // enter-роутер: созревший бит этой локации, иначе — хаб. Бит созрел =
    // slot в окне И guard-флаги выполнены И бит ещё не случился.
    const routerNode: GameSceneNode = {
      id: enterId(loc.id),
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs: [], sceneType: 'router' },
    };
    nodes.push(routerNode);

    for (const beat of beatsByLoc.get(loc.id) ?? []) {
      const outId = uniqueId(`${enterId(loc.id)}__${beat.id}`);
      routerNode.data.outputs.push({ id: outId, text: '' });
      edges.push({
        id: `e_${outId}`,
        source: enterId(loc.id),
        sourceHandle: outId,
        target: beat.id,
        condition: [{ path: beatVar(beat.id), lte: 0 }, ...windowConditions(beat), ...guardConditions(beat.guard)],
      });
    }
    // Безусловный fallback в хаб — ПОСЛЕДНИМ (страховка ROUTER_DEAD_END).
    const fallbackId = uniqueId(`${enterId(loc.id)}__hub`);
    routerNode.data.outputs.push({ id: fallbackId, text: '' });
    edges.push({ id: `e_${fallbackId}`, source: enterId(loc.id), sourceHandle: fallbackId, target: hubId(loc.id) });

    // hub: описание локации + действия.
    const hubOutputs: GameSceneOutput[] = [];
    const hubNode: GameSceneNode = {
      id: hubId(loc.id),
      type: 'scene',
      position: { x: 0, y: 0 },
      data: {
        label: escapeNL(loc.description) || loc.name,
        image: bgForLocation(loc.id),
        outputs: hubOutputs,
        sceneType: 'branch',
      },
    };
    nodes.push(hubNode);

    // 2a. Встречи: диапазон расписания × наличие прозы. Нет прозы — нет
    // кнопки (v1: unitProse ключуется enc_<liId>; фаза 3 привяжет юниты).
    for (const run of runsByLoc.get(loc.id) ?? []) {
      const variants = unitProse[`enc_${run.liId}`];
      if (!variants || variants.length === 0) continue;

      const met = metVar(run.liId, run.fromSlot);
      stateVars.set(met, { range: [0, 1], default: 0 });

      const outId = uniqueId(`${hubId(loc.id)}__meet_${run.liId}_${run.fromSlot}`);
      hubOutputs.push({ id: outId, text: `Поговорить с ${liNameById.get(run.liId) ?? run.liId}` });

      const encRouterId = uniqueId(`enc_${run.liId}_${run.fromSlot}`);
      edges.push({
        id: `e_${outId}`,
        source: hubId(loc.id),
        sourceHandle: outId,
        target: encRouterId,
        condition: [
          { path: SLOT_VAR, gte: run.fromSlot },
          { path: SLOT_VAR, lte: run.toSlot },
          { path: met, lte: 0 },
        ],
      });

      wireEncounter(encRouterId, run.liId, met, variants, loc.id);
      encountersWired++;
    }

    // 2b. Перемещение: БЕСПЛАТНО (slot не двигает) — рёбра графа локаций.
    for (const adj of neighbors.get(loc.id) ?? []) {
      const target = locById.get(adj.locationId);
      if (!target) continue;
      const outId = uniqueId(`${hubId(loc.id)}__go_${adj.locationId}`);
      hubOutputs.push({ id: outId, text: movementLabel(target, adj.via) });
      edges.push({ id: `e_${outId}`, source: hubId(loc.id), sourceHandle: outId, target: enterId(adj.locationId) });
    }

    // 2c. «Подождать»: единственный «холостой» ход времени. Возврат через
    // enter-роутер той же локации — созревший за время ожидания бит стреляет.
    const waitId = uniqueId(`${hubId(loc.id)}__wait`);
    hubOutputs.push({ id: waitId, text: 'Подождать', effects: { stateDeltas: { [SLOT_VAR]: 1 } } });
    edges.push({ id: `e_${waitId}`, source: hubId(loc.id), sourceHandle: waitId, target: enterId(loc.id) });
  }

  // Диалоговый encounter: router по брекетам отношений → сцены варианта →
  // возврат в hub локации. Выход помечает met и двигает slot (копия паттерна
  // compileWorldGame.wireEncounter, time → slot).
  function wireEncounter(
    encRouterId: string,
    liId: string,
    met: string,
    variantsRaw: DialogueVariant[],
    locId: string,
  ): void {
    const returnTarget = hubId(locId);
    const routerNode: GameSceneNode = {
      id: encRouterId,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs: [], sceneType: 'router' },
    };
    nodes.push(routerNode);

    // Безусловный neutral обязан идти последним — роутер берёт первое активное.
    const variants = [...variantsRaw].sort((a, b) => BRACKET_WIRE_ORDER[a.bracket] - BRACKET_WIRE_ORDER[b.bracket]);

    const exitEffects = (extraDeltas: Record<string, number>): Record<string, number> => ({
      ...extraDeltas,
      [met]: 1,
      [SLOT_VAR]: 1,
    });

    const audioProfile = buildSceneAudioProfile(liId, audio.byLi[liId]);

    for (const variant of variants) {
      const condition = bracketCondition(liId, variant.bracket);

      const sceneIdMap = new Map<string, string>();
      for (const vs of variant.scenes) {
        sceneIdMap.set(vs.id, uniqueId(`${encRouterId}_${vs.id}`));
      }

      const routerOutId = uniqueId(`${encRouterId}__${variant.bracket}`);
      routerNode.data.outputs.push({ id: routerOutId, text: '' });
      const condEdge: GameSceneEdge = {
        id: `e_${routerOutId}`,
        source: encRouterId,
        sourceHandle: routerOutId,
        target: sceneIdMap.get(variant.entrySceneId) ?? variant.entrySceneId,
      };
      if (condition.length > 0) condEdge.condition = condition;
      edges.push(condEdge);

      for (const vs of variant.scenes) {
        const vsId = sceneIdMap.get(vs.id)!;
        dialogueSceneCount++;

        const positions = assignPositions(vs.charactersPresent.length);
        const sprites: GameSpriteEntry[] = [];
        for (let ci = 0; ci < vs.charactersPresent.length; ci++) {
          const charId = vs.charactersPresent[ci];
          const emotion = pickCharacterEmotion(vs, charId);
          const { url } = resolveEmotionToSpriteUrl(characters[charId], emotion);
          if (url) sprites.push({ url, position: positions[ci] ?? 'center' });
        }

        const vsOutputs: GameSceneOutput[] = [];
        if (vs.choices.length === 0) {
          const autoId = uniqueId(`${vsId}__auto`);
          const nextVs = variant.scenes[variant.scenes.indexOf(vs) + 1];
          const isExit = !nextVs;
          vsOutputs.push(
            isExit ? { id: autoId, text: '', effects: { stateDeltas: exitEffects({}) } } : { id: autoId, text: '' },
          );
          edges.push({
            id: `e_${autoId}`,
            source: vsId,
            sourceHandle: autoId,
            target: nextVs ? sceneIdMap.get(nextVs.id) ?? nextVs.id : returnTarget,
          });
        } else {
          for (const c of vs.choices) {
            const cId = uniqueId(c.id);
            const isExit = c.nextSceneId === null;
            const deltas: Record<string, number> = isExit
              ? exitEffects(c.effects.stateDeltas)
              : { ...c.effects.stateDeltas };
            const hasEff =
              Object.keys(deltas).length > 0 || c.effects.flagSet.length > 0 || c.effects.flagClear.length > 0;
            const out: GameSceneOutput = { id: cId, text: c.text };
            if (hasEff) {
              out.effects = {
                stateDeltas: Object.keys(deltas).length > 0 ? deltas : undefined,
                flagSet: c.effects.flagSet.length > 0 ? c.effects.flagSet : undefined,
                flagClear: c.effects.flagClear.length > 0 ? c.effects.flagClear : undefined,
              };
            }
            vsOutputs.push(out);
            edges.push({
              id: `e_${cId}`,
              source: vsId,
              sourceHandle: cId,
              target: isExit ? returnTarget : sceneIdMap.get(c.nextSceneId!) ?? c.nextSceneId!,
            });
          }
        }

        nodes.push({
          id: vsId,
          type: 'scene',
          position: { x: 0, y: 0 },
          data: {
            label: renderDraftSceneText(vs.narration, vs.dialogue, id => liNameById.get(id) ?? id),
            image: bgForLocation(locId),
            sprite: sprites[0]?.url,
            sprites: sprites.length ? sprites : undefined,
            outputs: vsOutputs,
            sceneType: vs.choices.length === 0 ? 'narration' : 'dialogue',
            audioProfile,
            sfxUrl: resolveSfxUrl(pickCharacterEmotion(vs, liId), audio.sfx),
          },
        });
      }
    }

    // Страховка от ROUTER_DEAD_END при отсутствии neutral-варианта.
    const hasUnconditional = variants.some(v => bracketCondition(liId, v.bracket).length === 0);
    if (!hasUnconditional) {
      const fallbackId = uniqueId(`${encRouterId}__fallback`);
      routerNode.data.outputs.push({ id: fallbackId, text: '' });
      edges.push({ id: `e_${fallbackId}`, source: encRouterId, sourceHandle: fallbackId, target: returnTarget });
    }
  }

  // ── 3. Старт: интро-нарратив → enter первой локации ──────────────────
  // enter (а не hub): бит со слот-окном от 0 стреляет сразу.
  const startLocId =
    [...wirableBeats].sort(
      (a, b) =>
        a.window.fromSlot - b.window.fromSlot ||
        a.window.toSlot - b.window.toSlot ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0]?.locationId ?? worldModel.locations[0]?.id;
  if (startLocId) {
    const startId = uniqueId('game_start');
    const startOutId = uniqueId('game_start__go');
    nodes.push({
      id: startId,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: {
        label: escapeNL(spine.logline) || `${brief.world.setting.place}. История начинается.`,
        image: bgForLocation(startLocId),
        outputs: [{ id: startOutId, text: '' }],
        sceneType: 'narration',
      },
    });
    edges.push({ id: `e_${startOutId}`, source: startId, sourceHandle: startOutId, target: enterId(startLocId) });
  }

  // ── 4. Концовки: финал → ending_router → эпилоги по флагам и state ────
  if (hasEndings && endingRouterId) {
    const endingRouter: GameSceneNode = {
      id: endingRouterId,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs: [], sceneType: 'router' },
    };
    nodes.push(endingRouter);

    const endingImage = finaleBeat ? bgForLocation(finaleBeat.locationId) : '';

    const affectionMid = (liId: string): number => {
      const li = brief.loveInterests.find(l => l.id === liId);
      const init = li ? ARCHETYPES[li.archetype]?.initialState?.affection : undefined;
      return init ? (init[0] + init[1]) / 2 : 0;
    };
    const clampCond = (v: number) => Math.max(-1, Math.min(1, v));

    const wireEndingChain = (variant: EndingVariant, keySuffix: string): string => {
      const sceneIds = variant.scenes.map((sc, i) => uniqueId(sc.id || `ending_${keySuffix}_${i + 1}`));
      variant.scenes.forEach((sc, i) => {
        const isLast = i === variant.scenes.length - 1;
        const outputs: GameSceneOutput[] = [];
        if (!isLast) {
          const chainAutoId = uniqueId(`${sceneIds[i]}__auto`);
          outputs.push({ id: chainAutoId, text: '' });
          edges.push({
            id: `e_${chainAutoId}`,
            source: sceneIds[i],
            sourceHandle: chainAutoId,
            target: sceneIds[i + 1],
          });
        }
        nodes.push({
          id: sceneIds[i],
          type: 'scene',
          position: { x: 0, y: 0 },
          data: { label: escapeNL(sc.narration), image: endingImage, outputs, sceneType: 'narration' },
        });
        endingSceneCount++;
      });
      return sceneIds[0];
    };

    const wireRouterEdge = (target: string, suffix: string, condition?: GameStateCondition[]) => {
      const outId = uniqueId(`${endingRouterId}__${suffix}`);
      endingRouter.data.outputs.push({ id: outId, text: '' });
      const e: GameSceneEdge = { id: `e_${outId}`, source: endingRouterId, sourceHandle: outId, target };
      if (condition && condition.length > 0) e.condition = condition;
      edges.push(e);
    };

    // Условие концовки хребта: guard-флаги + affection-брекет (good — тепло
    // с конкретным LI, bad — все холодны, normal — только флаги).
    const endingCondition = (e: SpinePlan['endings'][number]): GameStateCondition[] => {
      const conds = guardConditions(e.guard);
      if (e.kind === 'good' && e.liId) {
        conds.push({ path: `relationship[${e.liId}].affection`, gte: clampCond(affectionMid(e.liId) + 0.25) });
      }
      if (e.kind === 'bad') {
        for (const li of brief.loveInterests) {
          conds.push({ path: `relationship[${li.id}].affection`, lte: clampCond(affectionMid(li.id) - 0.15) });
        }
      }
      return conds;
    };

    // Сначала условные концовки в порядке хребта, потом безусловные,
    // страховочный fallback — последним.
    const wired = spine.endings
      .map(e => ({ ending: e, variant: endings[endingKey(e.kind, e.liId)] }))
      .filter((w): w is { ending: SpinePlan['endings'][number]; variant: EndingVariant } => Boolean(w.variant))
      .map(w => ({ ...w, condition: endingCondition(w.ending) }));

    let lastEntry = '';
    let hasUnconditionalEnding = false;
    for (const w of [...wired.filter(w => w.condition.length > 0), ...wired.filter(w => w.condition.length === 0)]) {
      const entry = wireEndingChain(w.variant, w.ending.id);
      lastEntry = entry;
      wireRouterEdge(entry, w.ending.id, w.condition);
      if (w.condition.length === 0) hasUnconditionalEnding = true;
    }
    if (!hasUnconditionalEnding && lastEntry) {
      wireRouterEdge(lastEntry, 'fallback');
    }
  }

  // ── 5. Метаданные проекта ─────────────────────────────────────────────
  // buildStoryStateSchema даёт relationship-переменные брифа; флаги хребта
  // живут численными flag[...]-переменными (см. выше), поэтому outline-часть
  // схемы — пустой стаб.
  const stateSchema = buildStoryStateSchema(brief, { title: '', logline: '', acts: [], anchors: [], anchorEdges: [] });
  for (const [key, decl] of stateVars) {
    stateSchema.vars[key] = { range: decl.range, default: decl.default };
  }

  // Манифест мира (копия compileWorldGame): локации + уникальные рёбра.
  const seenPairs = new Set<string>();
  const worldEdges: GameWorldManifest['edges'] = [];
  for (const l of worldModel.locations) {
    for (const adj of l.adjacent) {
      if (!locById.has(adj.locationId)) continue;
      const key = [l.id, adj.locationId].sort().join('|');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      worldEdges.push({ from: l.id, to: adj.locationId, via: adj.via?.trim() || undefined });
    }
  }
  const world: GameWorldManifest = {
    locations: worldModel.locations.map(l => ({
      id: l.id,
      name: l.name,
      mood: isLocationMood(l.mood) ? l.mood : DEFAULT_LOCATION_MOOD,
      ...(isSpecialAmbientKind(l.specialKind) ? { specialKind: l.specialKind } : {}),
    })),
    edges: worldEdges,
  };

  const title = spine.title?.trim() || `${brief.world.setting.place} — пилот`;
  const bgmUrl = audioUrlFor(selectedTrackFile(audio.base));

  const ambientByMood: Record<string, string> = {};
  if (bgmUrl) ambientByMood[DEFAULT_LOCATION_MOOD] = bgmUrl;
  for (const [mood, track] of Object.entries(audio.moodBeds ?? {})) {
    const url = audioUrlFor(selectedTrackFile(track));
    if (url) ambientByMood[mood] = url;
  }
  const hasAmbient = Object.keys(ambientByMood).length > 0;

  const ambientBySpecial: Record<string, string> = {};
  for (const [kind, track] of Object.entries(audio.specialBeds ?? {})) {
    const url = audioUrlFor(selectedTrackFile(track));
    if (url) ambientBySpecial[kind] = url;
  }
  const hasSpecial = Object.keys(ambientBySpecial).length > 0;

  const project: GameProjectFile = {
    title,
    scenes: './scenes.json',
    settings: {
      sceneFadeInMs: 600,
      sceneFadeOutMs: 400,
      choiceAppearDelayMs: 120,
      endFadeInMs: 400,
      stateSchema,
      world,
      calendar: {
        slotCount: calendar.slotCount,
        dayparts: calendar.dayparts,
        actBoundaries: calendar.actBoundaries,
      },
      ...(bgmUrl ? { bgmUrl, crossfadeDurationMs: 2000, bgmVolume: 0.3, sfxVolume: 0.5 } : {}),
      ...(hasAmbient ? { ambientByMood } : {}),
      ...(hasSpecial ? { ambientBySpecial } : {}),
    },
  };

  return {
    project,
    scenes: { nodes, edges },
    stats: {
      locations: worldModel.locations.length,
      events: spine.beats.length,
      encountersWired,
      dialogueScenes: dialogueSceneCount,
      endingScenes: endingSceneCount,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      slotCount: calendar.slotCount,
      beatsWired,
    },
  };
}
