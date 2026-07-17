import type { AnchorBeat, Brief, DraftScene, EndingVariant, WorldLocation, WorldModel } from './types';
import { DEFAULT_LOCATION_MOOD, endingKey, isLocationMood, isSpecialAmbientKind } from './types';
import type { DialogueUnit, DialogueUnitNode } from './dialogueUnit';
import type { CharacterGenState, ImageGenState } from './narrativeStore';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { PHASES_PER_SLOT, phaseWindowForTiming } from './calendarTypes';
import { guardFlags } from './validateSpine';
import { guardFiredIds, unitEstablishes } from './parseEventPool';
import { applyBeatChain } from './beatChain';
import { applyLadderGuards } from './ladderGuards';
import type { Guard, PhaseWindow } from './events';
import type { AudioTrackState, LiAudioState } from './narrativeStore';
import type {
  GameProjectFile,
  GameSceneEdge,
  GameSceneGraph,
  GameSceneLineEntry,
  GameSceneNode,
  GameSceneOutput,
  GameSpriteEntry,
  GameStateCondition,
  GameWorldManifest,
} from './convertToGameProject';
import {
  BRACKET_WIRE_ORDER,
  LEGACY_BRACKET_THRESHOLDS,
  assignPositions,
  bracketCondition,
  bracketThresholdsFor,
  buildStoryStateSchema,
  escapeNL,
  imageUrlFor,
  renderDraftSceneText,
} from './convertToGameProject';
import type { BracketThresholds } from './convertToGameProject';
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
 *      (времени не двигает), плюс якорные переходы — диегетические сцены
 *      смены части дня («пойти спать»). Холостого «Подождать» НЕТ.
 *   2. ДВЕ СТРЕЛЫ ВРЕМЕНИ.
 *      Большая — slot (день × часть дня). Её двигает ТОЛЬКО сюжет: бит хребта
 *      и якорный переход. Разговоры её НЕ крутят — плейтест показал, во что
 *      это выливалось: беседа начиналась вечером, а после прощания наступало
 *      утро, и ночь исчезала как побочный эффект.
 *      Малая — phase, часы САМОГО СЛОТА (не бюджет игрока): closing встречи
 *      даёт phase+1, а каждый slot-двигающий выход несёт парную phase−P
 *      (движок клампит к 0 — см. advanceSlotDeltas). К поздней фазе персонаж
 *      «менее восприимчив»: окно at.phase закрывает глубокие ветки, остаются
 *      сюжетные. Дефицит создаёт мир, а не счётчик очков.
 *      Условия рёбер ЧИТАЮТ обе оси: [{path:'slot',gte/lte}] и то же для phase.
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

/**
 * Якорные переходы: диегетические действия смены части дня.
 *
 * `narrations` — по индексу части дня (последняя = сон); нет записи → статичный
 * фолбэк, история играбельна и без единой генерации. `tagMap` даёт тег 'home' —
 * куда уводит сон.
 */
export type AnchorTransitionsInput = {
  narrations?: Record<number, { label: string; narration: string }>;
  tagMap?: Record<string, string[]> | null;
};

/** Сгенерированные аудио-артефакты, подаваемые компилятору. */
export type WorldAudioInput = {
  base: AudioTrackState | null;
  /** Банк эмбиентов по настроению локации (LocationMood → трек). */
  moodBeds: Record<string, AudioTrackState>;
  /** Диегетические беды особых локаций (SpecialAmbientKind → трек). */
  specialBeds: Record<string, AudioTrackState>;
  byLi: Record<string, LiAudioState>;
  sfx: Record<string, string>;
};

export type WorldCompileStats = {
  locations: number;
  events: number;
  encountersWired: number;
  dialogueScenes: number;
  endingScenes: number;
  totalNodes: number;
  totalEdges: number;
};

export type CalendarCompileStats = WorldCompileStats & {
  slotCount: number;
  /** Битов хребта, доведённых до узлов (locationId найден в мире). */
  beatsWired: number;
  /** Развилок хребта (kind=branchPoint). */
  branchPoints: number;
  /**
   * Ветвовых битов: guard требует флаг исхода развилки — контент одной
   * ветки. Инвариант линейного роста: ветка добавляет ровно эти биты,
   * а не копии графа (ассерт в тестах).
   */
  branchExclusiveBeats: number;
};

export type CalendarCompileResult = {
  project: GameProjectFile;
  scenes: GameSceneGraph;
  stats: CalendarCompileStats;
};

const hubId = (locId: string) => `hub_${locId}`;
const enterId = (locId: string) => `enter_${locId}`;
const SLOT_VAR = 'slot';
/** Малая стрелка: часы внутри части дня. */
const PHASE_VAR = 'phase';

/**
 * Дельты продвижения большой стрелки — ВСЕГДА парой.
 *
 * Инвариант: slot+1 не появляется без phase−P. Движок клампит к range[0]=0, так
 * что вычитание всего запаса фаз и есть их сброс — set-эффект не нужен. Пара
 * живёт одним хелпером, чтобы «забыть сбросить фазу» было негде: забытый сброс
 * означал бы, что в новой части дня персонажи уже никого не слушают.
 */
const advanceSlotDeltas = (): Record<string, number> => ({ [SLOT_VAR]: 1, [PHASE_VAR]: -PHASES_PER_SLOT });
const beatVar = (beatId: string) => `beat[${beatId}]`;
const flagVar = (flag: string) => `flag[${flag}]`;
/** met-переменная per (LI, начало диапазона слотов) — встреча одноразова. */
const metVar = (liId: string, fromSlot: number) => `met[${liId}].${fromSlot}`;
/** 0/1-переменная «юнит сыгран» — fired-цепочки битового стиля (beat[...]). */
const unitVar = (unitId: string) => `unit[${unitId}]`;
/** met per unit id — одноразовость встречи-юнита. */
const unitMetVar = (unitId: string) => `met[${unitId}]`;

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

/** rel-переменная отношений героини с персонажем. */
const relVar = (liId: string, name: string) => `relationship[${liId}].${name}`;
/** «Вершина арки этого LI сыграна» — H-гейт good-концовки. */
const arcPeakFlag = (liId: string) => `arc_peak_${liId}`;

/**
 * rel-условия ЛЕСТНИЦЫ на ребро: {rel: affection >= t} → relationship[li].affection ≥ t.
 *
 * Раньше guardConditions молча выбрасывал rel-листья — половина модели событий
 * (R) до собранной игры не доезжала, и «ступень близости» держалась на одних
 * флагах. Движок читает такие условия как есть (gte/lte по числу), правок в нём
 * не нужно.
 *
 * Транслируется ТОЛЬКО плоская конъюнкция верхнего уровня с >=/<=: под not/any
 * инклюзивного эквивалента нет (у движка нет OR и строгих сравнений), а молча
 * выбросить — это ровно тот класс бага, который мы чиним. Такие формы ловит
 * линтом ladderLint.
 */
function relConditions(guard: Guard, liId: string): GameStateCondition[] {
  const leaves = 'all' in guard ? guard.all : [guard];
  const conds: GameStateCondition[] = [];
  for (const g of leaves) {
    if (!('rel' in g)) continue;
    const { var: name, op, value } = g.rel;
    if (op === '>=') conds.push({ path: relVar(liId, name), gte: value });
    else if (op === '<=') conds.push({ path: relVar(liId, name), lte: value });
  }
  return conds;
}

/** rel-листья, которые компилятор выразить НЕ может (движок без OR/строгих). */
export function ladderLint(guard: Guard, scope: string): string[] {
  const issues: string[] = [];
  const walk = (g: Guard, nested: boolean) => {
    if ('all' in g) {
      for (const x of g.all) walk(x, nested);
      return;
    }
    if ('any' in g) {
      for (const x of g.any) walk(x, true);
      return;
    }
    if ('not' in g) {
      walk(g.not, true);
      return;
    }
    if ('rel' in g) {
      if (nested) issues.push(`${scope}: rel-гейт под any/not — движок без OR такое не выразит`);
      else if (g.rel.op !== '>=' && g.rel.op !== '<=') {
        issues.push(`${scope}: строгое сравнение "${g.rel.op}" в rel-гейте — движок умеет только ≥/≤`);
      }
    }
  };
  walk(guard, false);
  return issues;
}

/** Окно слотов бита → численные условия по slot. */
function windowConditions(beat: SpineBeat, slotCount?: number): GameStateCondition[] {
  // Финал достаёт до ПОТОЛКА клампа: последний якорь («лечь спать» в последний
  // вечер) упирает slot в slotCount, и финал с окном до slotCount-1 стал бы
  // недостижим — игра кончалась бы ничем, вместо концовки.
  const toSlot =
    beat.kind === 'finale' && slotCount != null ? Math.max(beat.window.toSlot, slotCount) : beat.window.toSlot;
  return [
    { path: SLOT_VAR, gte: beat.window.fromSlot },
    { path: SLOT_VAR, lte: toSlot },
  ];
}

/**
 * Окно восприимчивости → условия ребра. Окна нет → фаза не гейтит: так живут
 * биты хребта, «остаются только ветки глобального сюжета» из ТЗ автора.
 */
function phaseConditions(phase?: PhaseWindow): GameStateCondition[] {
  if (!phase) return [];
  return [
    { path: PHASE_VAR, gte: phase.fromPhase },
    { path: PHASE_VAR, lte: phase.toPhase },
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
/**
 * Анти-софтлок: из КАЖДОГО хаба в КАЖДОМ слоте календаря должен быть доступен
 * якорный переход — действие, двигающее большую стрелку.
 *
 * Это инвариант, а не придирка. «Подождать» убрано, время двигают только сюжет
 * и якоря; стоит хабу остаться без якоря хотя бы в одном слоте — и игрок,
 * зашедший туда, застревает навсегда: разговоры фазу выжгут, а часть дня
 * никогда не сменится. Проверяем по слот-условиям рёбер, а не по namespace id:
 * важно фактическое покрытие, а не то, как узел назвали.
 */
export function lintAnchorCoverage(scenes: GameSceneGraph, slotCount: number): string[] {
  const issues: string[] = [];
  const advancing = new Set(
    scenes.nodes.filter(n => n.data.outputs.some(o => (o.effects?.stateDeltas ?? {})['slot'])).map(n => n.id),
  );

  for (const node of scenes.nodes) {
    if (!node.id.startsWith('hub_')) continue;
    const outIds = new Set(node.data.outputs.map(o => o.id));
    const covered = new Set<number>();
    for (const e of scenes.edges) {
      if (e.source !== node.id || !outIds.has(e.sourceHandle ?? '') || !advancing.has(e.target)) continue;
      const gte = e.condition?.find(c => c.path === 'slot' && c.gte != null)?.gte;
      const lte = e.condition?.find(c => c.path === 'slot' && c.lte != null)?.lte;
      const from = gte ?? 0;
      const to = lte ?? slotCount - 1;
      for (let v = from; v <= Math.min(to, slotCount - 1); v++) covered.add(v);
    }
    const gaps = [];
    for (let v = 0; v < slotCount; v++) if (!covered.has(v)) gaps.push(v);
    if (gaps.length > 0) {
      issues.push(
        `hub "${node.id}": нет якорного перехода в слотах [${gaps.join(', ')}] — игрок застрянет там навсегда`,
      );
    }
  }
  return issues;
}

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
  rawSpine: SpinePlan,
  calendar: Calendar,
  schedule: CharacterSchedule,
  worldModel: WorldModel,
  spineBeatProse: Record<string, AnchorBeat> = {},
  unitProse: Record<string, DialogueUnit[]> = {},
  eventUnits: Record<string, EventUnit> = {},
  endings: Record<string, EndingVariant> = {},
  images: Record<string, ImageGenState> = {},
  characters: Record<string, CharacterGenState> = {},
  audio: WorldAudioInput = { base: null, moodBeds: {}, specialBeds: {}, byLi: {}, sfx: {} },
  anchors: AnchorTransitionsInput = {},
): CalendarCompileResult {
  const perDay = calendar.dayparts.length;
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

  // Юниты пула событий (фаза 4): при их наличии встречи проводятся PER UNIT —
  // окно юнита + флаговый guard + fired-цепочка через unit[<id>]-переменные.
  // Пустой пул = фаза-3 поведение (диапазоны расписания, enc_<liId>).
  // Лестница отношений: ступени гейтятся по f(z, R, H) — полы окон, rel-пороги
  // и fired-цепочки. Выводится при чтении (ничего не хранится), поэтому
  // персистнутые истории получают гейты прямо здесь, без миграции. Валидаторы и
  // story QA зовут ту же идемпотентную функцию — иначе игра, валидатор и QA
  // разойдутся.
  const ladder = applyLadderGuards(
    Object.values(eventUnits).filter(u => u.kind === 'dialogue' && u.at.locationId != null && u.at.slot != null),
    rawSpine,
    calendar,
    brief,
  );

  // Юниты пула событий (фаза 4): при их наличии встречи проводятся PER UNIT —
  // окно юнита + флаговый guard + fired-цепочка через unit[<id>]-переменные.
  // Пустой пул = фаза-3 поведение (диапазоны расписания, enc_<liId>).
  const dialogueUnits = [...ladder.units].sort(
    (a, b) => a.at.slot!.fromSlot - b.at.slot!.fromSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const useUnitEncounters = dialogueUnits.length > 0;

  // Порядок битов навязывает ДВИЖОК, а не флаги от LLM: цепочка выводится из
  // раскладки битов по слотам и доезжает до рёбер как {fired: …}. Применяется
  // ДО любого чтения spine.beats — валидатор и story QA зовут ту же
  // (идемпотентную) applyBeatChain, иначе игра, валидатор и QA разойдутся.
  // Персистнутый хребет с пустым requires чинится здесь же — без миграции.
  const spine = applyBeatChain(ladder.spine, calendar, new Set(brief.loveInterests.map(li => li.id)), dialogueUnits);

  const beatIds = new Set(spine.beats.map(b => b.id));
  /** fired-депы → условия: предшественник-бит beat[…], гейт-встреча unit[…]. */
  const firedConditions = (guard: Guard): GameStateCondition[] =>
    guardFiredIds(guard).map(dep =>
      beatIds.has(dep) ? { path: beatVar(dep), gte: 1 } : { path: unitVar(dep), gte: 1 },
    );

  const liIds = new Set(brief.loveInterests.map(li => li.id));
  /** Персонаж, к чьим отношениям относится rel-гейт сцены (ctx.x модели событий). */
  const primaryLiOf = (participants: string[]): string => participants.find(p => liIds.has(p)) ?? '';

  /**
   * LI, чью вершину арки реально провели (юнит последней ступени с прозой).
   * Гейтить good-концовку флагом, который никто не ставит, — значит молча
   * сделать её недостижимой: юнит без прозы компилятор пропускает, а ступени
   * может не быть в пуле вовсе.
   */
  const peakWiredLis = new Set<string>();

  /**
   * Следующая ступень, доступная в ТОЙ ЖЕ посиделке: юнит того же LI, той же
   * локации, ступенью выше, с прозой и пересекающимся окном.
   *
   * Ради чего: ступени пула разнесены по окнам, поэтому «разговор пошёл хорошо»
   * не значило ничего — следующая ступень ждала своего дня. Игрок подмигивал, а
   * движок крутил время с обеда на вечер, лишь бы открыть следующий бит. Здесь
   * разговор продолжается сразу, а стрелка частей дня стоит.
   *
   * Тай-брейк (ступень, слот, id) детерминирован: цепочку стадий parseEventPool
   * вешает на ХВОСТ предыдущей ступени, поэтому кандидатов может быть несколько.
   */
  function continuationFor(
    unit: EventUnit,
    locId: string,
  ): {
    unit: EventUnit;
    prose: DialogueUnit[];
    entryConditions: GameStateCondition[];
    closingExtras: Record<string, number>;
  } | null {
    const liId = unit.participants[0] ?? '';
    if (!liId) return null;
    const stage = unit.arcStage ?? 1;
    const w = unit.at.slot!;

    const candidates = dialogueUnits
      .filter(u => u.participants[0] === liId && u.at.locationId === locId && (u.arcStage ?? 1) === stage + 1)
      // Окна обязаны пересекаться: продолжение живёт в ТОМ ЖЕ слоте, что и
      // первая встреча (слот посиделка тратит один раз, в конце).
      .filter(u => u.at.slot!.fromSlot <= w.toSlot && u.at.slot!.toSlot >= w.fromSlot)
      .filter(u => (unitProse[u.id] ?? []).some(p => Array.isArray(p?.nodes)))
      .sort((a, b) => a.at.slot!.fromSlot - b.at.slot!.fromSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const next = candidates[0];
    if (!next) return null;

    const prose = (unitProse[next.id] ?? []).filter(p => Array.isArray(p?.nodes));
    // Флаги, которые ставит закрытие ПЕРВОЙ встречи, из условий входа вычитаем:
    // движок применяет их до оценки рёбер, но требовать их у продолжения — это
    // требовать доказательства того, что только что случилось здесь же.
    const justSet = new Set(unitEstablishes(unit));
    const entryConditions: GameStateCondition[] = [
      { path: SLOT_VAR, gte: next.at.slot!.fromSlot },
      { path: SLOT_VAR, lte: next.at.slot!.toSlot },
      // Правило продолжения: восприимчивость гейтит ЗАВЕДЕНИЕ разговора, а не
      // уже идущий. Требовать здесь окно at.phase следующей ступени нельзя:
      // закрытие первой уже потратило фазу, и early-продолжение стало бы
      // невозможным вовсе — а автор требовал продвижения внутри посиделки.
      // Живой разговор не обрывают потому, что «настала вторая половина дня»;
      // нужен лишь незакончившийся слот.
      { path: PHASE_VAR, lte: PHASES_PER_SLOT - 1 },
      { path: unitMetVar(next.id), lte: 0 },
      ...guardFlags(next.guard)
        .filter(f => !justSet.has(f))
        .map(f => ({ path: flagVar(f), gte: 1 })),
      // fired-деп на первую встречу — тавтология по месту ребра (мы вышли из
      // её closing-а), остальные проверяем.
      ...guardFiredIds(next.guard)
        .filter(dep => dep !== unit.id)
        .map(dep => (beatIds.has(dep) ? { path: beatVar(dep), gte: 1 } : { path: unitVar(dep), gte: 1 })),
      ...relConditions(next.guard, liId),
    ];

    const closingExtras: Record<string, number> = { [unitVar(next.id)]: 1 };
    for (const f of unitEstablishes(next)) closingExtras[flagVar(f)] = 1;
    const gain = ladder.plan.closingGain.get(next.id) ?? 0;
    if (gain > 0) closingExtras[relVar(liId, 'affection')] = gain;
    if ((next.arcStage ?? 1) >= ladder.plan.stageCount) {
      closingExtras[flagVar(arcPeakFlag(liId))] = 1;
      peakWiredLis.add(liId);
    }

    return { unit: next, prose, entryConditions, closingExtras };
  }

  /**
   * Пороги тона этого LI. Относительные — только когда у истории есть лестница
   * (пул диалоговых юнитов): персистнутая история без неё обязана звучать
   * ровно как раньше, иначе апгрейд молча переставит тональный роутинг и аудио
   * у уже отсмотренных автором сцен.
   */
  const bracketThresholdsOf = (liId: string): BracketThresholds =>
    useUnitEncounters ? bracketThresholdsFor(ladder.plan.startByLi.get(liId) ?? 0.15) : LEGACY_BRACKET_THRESHOLDS;

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

  // Стартовая локация — там, где стоит самый ранний бит: игра начинается с
  // сюжета, а не с пустого хаба. Нужна и якорям (см. homeLocId), поэтому
  // считается до цикла локаций.
  const startLocId =
    [...wirableBeats].sort(
      (a, b) =>
        a.window.fromSlot - b.window.fromSlot ||
        a.window.toSlot - b.window.toSlot ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0]?.locationId ?? worldModel.locations[0]?.id;

  // Дом героя: куда уводит сон. Тег 'home' — договорённость tagMap; его нет
  // (старые истории, пустой tagMap) — спим там же, где начали. Фолбэк молчит
  // не по лени: без него сон стал бы недоступен, а это единственный выход из
  // вечера — игра встала бы намертво.
  const homeLocId =
    (anchors.tagMap?.home ?? []).find(id => locById.has(id)) ?? startLocId ?? worldModel.locations[0]?.id ?? '';

  // ── Переменные состояния ──────────────────────────────────────────────
  // slot: реальная стрела времени, читаемая условиями рёбер. Диапазон до
  // slotCount (не slotCount-1): движок клампит дельты по range, «Подождать»
  // на излёте календаря просто упирается в потолок.
  stateVars.set(SLOT_VAR, { range: [0, calendar.slotCount], default: 0 });
  // Малая стрелка. Нижняя граница 0 — она же механизм сброса: парная дельта
  // −P на slot-двигающем выходе клампится сюда (правок движка не нужно).
  stateVars.set(PHASE_VAR, { range: [0, PHASES_PER_SLOT], default: 0 });
  for (const beat of spine.beats) stateVars.set(beatVar(beat.id), { range: [0, 1], default: 0 });
  // Флаги guard-ов ОБЯЗАНЫ быть численными 0/1-переменными: engine.ts
  // getActiveEdges оценивает условия только по state, не по flags.
  const allFlags = new Set<string>();
  // Флаги исходов развилок — для подсчёта ветвовых битов в статистике.
  const outcomeFlags = new Set<string>();
  for (const beat of spine.beats) {
    for (const f of beat.establishes) allFlags.add(f);
    for (const o of beat.outcomes ?? []) {
      allFlags.add(o.setsFlag);
      outcomeFlags.add(o.setsFlag);
    }
    for (const f of guardFlags(beat.guard)) allFlags.add(f);
  }
  for (const e of spine.endings) for (const f of guardFlags(e.guard)) allFlags.add(f);

  for (const u of dialogueUnits) {
    stateVars.set(unitVar(u.id), { range: [0, 1], default: 0 });
    for (const f of unitEstablishes(u)) allFlags.add(f);
    for (const f of guardFlags(u.guard)) allFlags.add(f);
    // Вершина арки: флаг ставится closing-ом юнита последней ступени.
    const liId = u.participants[0] ?? '';
    if (liId && (u.arcStage ?? 1) >= ladder.plan.stageCount) allFlags.add(arcPeakFlag(liId));
  }

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
    // Бит — сюжет, а сюжет и есть один из двух двигателей большой стрелки.
    const exitDeltas: Record<string, number> = { [beatVar(beat.id)]: 1, ...advanceSlotDeltas() };
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
  // Фаза-3 фолбэк: диапазоны встреч по локациям (run-length по расписанию).
  const runsByLoc = new Map<string, ScheduleRun[]>();
  if (!useUnitEncounters) {
    for (const run of scheduleRuns(schedule, calendar.slotCount)) {
      if (!locById.has(run.locId)) continue;
      if (!runsByLoc.has(run.locId)) runsByLoc.set(run.locId, []);
      runsByLoc.get(run.locId)!.push(run);
    }
  }

  // Фаза 4: юниты пула по локациям (проза обязательна — без неё юнит пропускается).
  const unitsByLoc = new Map<string, EventUnit[]>();
  for (const u of dialogueUnits) {
    const locId = u.at.locationId!;
    if (!locById.has(locId)) continue;
    if (!unitsByLoc.has(locId)) unitsByLoc.set(locId, []);
    unitsByLoc.get(locId)!.push(u);
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
        condition: [
          { path: beatVar(beat.id), lte: 0 },
          ...windowConditions(beat, calendar.slotCount),
          ...guardConditions(beat.guard),
          // Цепочка порядка: предшественник по линии (beat[…]) или встреча,
          // разблокирующая голову линии (unit[…]). Namespace различаем по
          // членству в множестве id битов — id битов и юнитов не пересекаются.
          ...firedConditions(beat.guard),
          // Ступень лестницы: сюжетная сцена с LI требует накопленной близости.
          // Порог — по первичному участнику (лист {rel} персонажа не несёт).
          ...relConditions(beat.guard, primaryLiOf(beat.participants)),
        ],
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

    // 2a-unit (фаза 4). Встречи PER dialogue-юнит пула: кнопка гейтится
    // окном юнита, флагами guard-а и fired-цепочкой (unit[<dep>] ≥ 1);
    // одноразовость — met[<unitId>]. Closing-переход ставит met + unit[<id>]
    // + establishes-флаги и двигает slot. Юнит без прозы пропускается.
    for (const unit of unitsByLoc.get(loc.id) ?? []) {
      const units3 = (unitProse[unit.id] ?? []).filter(u => Array.isArray(u?.nodes));
      if (units3.length === 0) continue;
      const liId = unit.participants[0] ?? '';

      const met = unitMetVar(unit.id);
      stateVars.set(met, { range: [0, 1], default: 0 });

      const outId = uniqueId(`${hubId(loc.id)}__meet_${unit.id}`);
      // «Поговорить: <имя>» — имя в именительном, чтобы не склонять («с Кира»).
      hubOutputs.push({ id: outId, text: `Поговорить: ${liNameById.get(liId) ?? liId}` });

      const encRouterId = uniqueId(`enc_${unit.id}`);
      edges.push({
        id: `e_${outId}`,
        source: hubId(loc.id),
        sourceHandle: outId,
        target: encRouterId,
        condition: [
          { path: SLOT_VAR, gte: unit.at.slot!.fromSlot },
          { path: SLOT_VAR, lte: unit.at.slot!.toSlot },
          // Восприимчивость: окно фаз ЗАВЕДЕНИЯ разговора. Его назначил либо
          // сам юнит (timing от смысла сцены), либо дефолт ступени.
          ...phaseConditions(unit.at.phase),
          { path: met, lte: 0 },
          ...guardConditions(unit.guard),
          ...firedConditions(unit.guard),
          // Ступень лестницы: без накопленной близости встреча не открывается.
          ...relConditions(unit.guard, liId),
        ],
      });

      // Closing-переход: юнит сыгран, его флаги установлены, время двинулось.
      const closingExtras: Record<string, number> = { [unitVar(unit.id)]: 1 };
      for (const f of unitEstablishes(unit)) closingExtras[flagVar(f)] = 1;
      // Валюта арки — детерминированный гейн ступени, а НЕ relEffects от LLM:
      // жирные значения фармились бы холодной прогонкой, нулевые делали бы
      // пороги недостижимыми. Вторую половину шага несут выборы игрока.
      const gain = ladder.plan.closingGain.get(unit.id) ?? 0;
      if (gain > 0) closingExtras[relVar(liId, 'affection')] = gain;
      // Вершина арки сыграна. Флагом, а не unit[<id>]: ступень несёт несколько
      // юнитов, а условия движка — конъюнкция без OR, поэтому «любой из» иначе
      // не выразить (требовать все — история непроходима, один произвольный —
      // остальные становятся ловушкой).
      if ((unit.arcStage ?? 1) >= ladder.plan.stageCount && liId) {
        closingExtras[flagVar(arcPeakFlag(liId))] = 1;
        peakWiredLis.add(liId);
      }

      // ── Продолжение разговора внутри той же посиделки ──────────────────
      // Если следующая ступень доступна здесь и сейчас, игрок не обязан ждать
      // следующего дня: разговор продолжается, время внутри него идёт фазами.
      // Каждая ступень тратит свою фазу — кап «сколько ступеней за присест»
      // теперь арифметический (P фаз в слоте), а не структурный.
      const next = continuationFor(unit, loc.id);
      if (!next) {
        wireEncounter(encRouterId, liId, met, units3, loc.id, closingExtras);
        encountersWired++;
        continue;
      }

      const contId = uniqueId(`cont_${unit.id}`);
      wireEncounter(encRouterId, liId, met, units3, loc.id, closingExtras, { closingTarget: contId });
      encountersWired++;

      // Продолженный экземпляр следующего юнита: проза та же (ноль генерации),
      // met/unit общие с его «свежей» кнопкой — сыграв продолжением, игрок
      // закрывает и её. Своего продолжения у него нет: цепочку продолжений
      // ограничивает запас фаз слота, но структурный кап оставляем — он
      // страхует от каскада, если P когда-нибудь вырастет.
      const nextMet = unitMetVar(next.unit.id);
      stateVars.set(nextMet, { range: [0, 1], default: 0 });
      const contEncId = uniqueId(`enc_cont_${next.unit.id}`);
      wireEncounter(contEncId, liId, nextMet, next.prose, loc.id, next.closingExtras);
      encountersWired++;

      const contOutputs: GameSceneOutput[] = [];
      nodes.push({
        id: contId,
        type: 'scene',
        position: { x: 0, y: 0 },
        data: {
          label: `${liNameById.get(liId) ?? liId} не спешит уходить. Разговор ещё не окончен.`,
          image: bgForLocation(loc.id),
          outputs: contOutputs,
          sceneType: 'branch',
        },
      });

      const contOutId = uniqueId(`${contId}__go`);
      contOutputs.push({ id: contOutId, text: 'Продолжить разговор' });
      edges.push({
        id: `e_${contOutId}`,
        source: contId,
        sourceHandle: contOutId,
        target: contEncId,
        // Полные условия входа следующей ступени. Эффекты закрытия первой
        // встречи (гейн ступени, флаги) движок применяет ДО оценки этих рёбер,
        // поэтому тёплый разговор честно открывает продолжение здесь же.
        // Флаги, которые ставит сам первый юнит, из условия вычитаются — иначе
        // гейт требовал бы того, что произошло секунду назад... в этом же присесте.
        condition: next.entryConditions,
      });

      // Прощание — безусловным и ПОСЛЕДНИМ. Времени не двигает: фазу уже
      // списало закрытие ступени, а большая стрелка разговорам не подчиняется.
      // Ведёт в прощальную сцену (её проза звучит только при реальном уходе),
      // а та — через enter-роутер: созревший за разговор бит должен выстрелить.
      const byeId = uniqueId(`${contId}__bye`);
      contOutputs.push({ id: byeId, text: 'Попрощаться' });
      edges.push({
        id: `e_${byeId}`,
        source: contId,
        sourceHandle: byeId,
        target: wireFarewellRouter(units3, liId, loc.id),
      });
    }

    // 2a. Фаза-3 фолбэк (пустой пул): диапазон расписания × наличие прозы.
    // Нет прозы — нет кнопки. unitProse ключуется enc_<liId> и несёт
    // DialogueUnit-графы; записи без nodes (легаси DialogueVariant-форма из
    // persisted v9) молча отбрасываются — их структуру компилятор не понимает.
    for (const run of runsByLoc.get(loc.id) ?? []) {
      const units = (unitProse[`enc_${run.liId}`] ?? []).filter(u => Array.isArray(u?.nodes));
      if (units.length === 0) continue;

      const met = metVar(run.liId, run.fromSlot);
      stateVars.set(met, { range: [0, 1], default: 0 });

      const outId = uniqueId(`${hubId(loc.id)}__meet_${run.liId}_${run.fromSlot}`);
      hubOutputs.push({ id: outId, text: `Поговорить: ${liNameById.get(run.liId) ?? run.liId}` });

      const encRouterId = uniqueId(`enc_${run.liId}_${run.fromSlot}`);
      edges.push({
        id: `e_${outId}`,
        source: hubId(loc.id),
        sourceHandle: outId,
        target: encRouterId,
        condition: [
          { path: SLOT_VAR, gte: run.fromSlot },
          { path: SLOT_VAR, lte: run.toSlot },
          // Ступеней у фолбэка нет — трактуем как знакомство: заводится в любой
          // фазе слота, пока он не выжат.
          ...phaseConditions(phaseWindowForTiming('any')),
          { path: met, lte: 0 },
        ],
      });

      wireEncounter(encRouterId, run.liId, met, units, loc.id);
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

    // 2c. Якорные переходы: единственный (кроме битов) двигатель большой
    // стрелки. Холостого «Подождать» больше нет — время нельзя промотать, в
    // нём можно только двигаться вперёд поступком: пойти на занятия, лечь
    // спать. Переход — диегетическая мини-сцена, а не кнопка-промотка.
    //
    // По выходу на часть дня; ребро — на КАЖДЫЙ слот этой части (движок не
    // умеет slot mod perDay, а вечера дискретны и компилятору известны).
    // В любом слоте активен ровно один якорь — тот, чья часть дня сейчас.
    for (let d = 0; d < perDay; d++) {
      const slotsOfDaypart: number[] = [];
      for (let v = 0; v < calendar.slotCount; v++) if (v % perDay === d) slotsOfDaypart.push(v);
      if (slotsOfDaypart.length === 0) continue;

      const isSleep = d === perDay - 1;
      const custom = anchors.narrations?.[d];
      const label =
        custom?.label?.trim() || (isSleep ? 'Пойти спать' : `Двигаться дальше: ${calendar.dayparts[d + 1]}`);
      const narration =
        custom?.narration?.trim() ||
        (isSleep
          ? 'Ты возвращаешься домой. День закончился; сон приходит быстро.'
          : `Время идёт своим чередом. Наступает ${calendar.dayparts[d + 1]}.`);

      // Сон уводит домой и в утро; остальные переходы оставляют на месте.
      const anchorNodeId = uniqueId(`anchor_${loc.id}_${d}`);
      const anchorAdvanceId = uniqueId(`${anchorNodeId}__go`);
      nodes.push({
        id: anchorNodeId,
        type: 'scene',
        position: { x: 0, y: 0 },
        data: {
          label: escapeNL(narration),
          image: bgForLocation(isSleep ? homeLocId : loc.id),
          outputs: [{ id: anchorAdvanceId, text: '', effects: { stateDeltas: advanceSlotDeltas() } }],
          sceneType: 'narration',
        },
      });
      edges.push({
        id: `e_${anchorAdvanceId}`,
        source: anchorNodeId,
        sourceHandle: anchorAdvanceId,
        target: enterId(isSleep ? homeLocId : loc.id),
      });

      const anchorOutId = uniqueId(`${hubId(loc.id)}__anchor_${d}`);
      hubOutputs.push({ id: anchorOutId, text: label });
      for (const v of slotsOfDaypart) {
        edges.push({
          id: `e_${anchorOutId}_${v}`,
          source: hubId(loc.id),
          sourceHandle: anchorOutId,
          target: anchorNodeId,
          condition: [
            { path: SLOT_VAR, gte: v },
            { path: SLOT_VAR, lte: v },
          ],
        });
      }
    }
  }

  /**
   * Прощальная сцена на ветке «Попрощаться» — роутер по брекетам.
   *
   * Нужна ТОЛЬКО там, где у посиделки есть продолжение: без него закрытие
   * ступени и есть уход, и прощальная реплика в нём уместна. А с продолжением
   * тело ступени обязано кончаться паузой — иначе выходит то, что поймал живой
   * плейтест: Асель говорит «Спасибо за разговор, надеюсь, скоро увидимся», и
   * следом узел сообщает, что она не спешит уходить.
   *
   * Последнее ребро безусловно (lintRouters): вариант без farewell уходит в
   * хаб молча — старая проза, написанная до этого контракта, играет как играла.
   */
  function wireFarewellRouter(unitsRaw: DialogueUnit[], liId: string, locId: string): string {
    const routerId = uniqueId(`farewell_${liId}_${locId}`);
    const outputs: GameSceneOutput[] = [];
    nodes.push({
      id: routerId,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs, sceneType: 'router' },
    });

    const withFarewell = [...unitsRaw]
      .filter(u => u.farewell && (u.farewell.narration || u.farewell.dialogue.length))
      .sort((a, b) => BRACKET_WIRE_ORDER[a.bracket] - BRACKET_WIRE_ORDER[b.bracket]);

    for (const u of withFarewell) {
      const sceneId = uniqueId(`${routerId}_${u.bracket}`);
      const autoId = uniqueId(`${sceneId}__auto`);
      const lines: GameSceneLineEntry[] = [];
      const narration = escapeNL(u.farewell!.narration);
      if (narration) lines.push({ text: narration });
      for (const dl of u.farewell!.dialogue) {
        lines.push({ speaker: liNameById.get(dl.speaker) ?? dl.speaker, text: dl.line });
      }
      nodes.push({
        id: sceneId,
        type: 'scene',
        position: { x: 0, y: 0 },
        data: {
          label: lines.map(l => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join('\n'),
          image: bgForLocation(locId),
          outputs: [{ id: autoId, text: '' }],
          sceneType: 'narration',
          lines,
        },
      });
      edges.push({ id: `e_${autoId}`, source: sceneId, sourceHandle: autoId, target: enterId(locId) });

      const outId = uniqueId(`${routerId}__${u.bracket}`);
      outputs.push({ id: outId, text: '' });
      const cond = bracketCondition(liId, u.bracket, bracketThresholdsOf(liId));
      const edge: GameSceneEdge = { id: `e_${outId}`, source: routerId, sourceHandle: outId, target: sceneId };
      if (cond.length > 0) edge.condition = cond;
      edges.push(edge);
    }

    const fallbackId = uniqueId(`${routerId}__none`);
    outputs.push({ id: fallbackId, text: '' });
    edges.push({ id: `e_${fallbackId}`, source: routerId, sourceHandle: fallbackId, target: enterId(locId) });
    return routerId;
  }

  // Адаптер узла юнита под DraftScene-хелперы (pickCharacterEmotion и др.).
  function nodeAsDraftScene(node: DialogueUnitNode): DraftScene {
    return {
      id: node.id,
      location: '',
      timeMarker: '',
      charactersPresent: node.charactersPresent,
      characterEmotions: node.characterEmotions,
      narration: node.narration,
      dialogue: node.dialogue,
      choices: [],
    };
  }

  // Диалоговый encounter (фаза 3): router по брекетам отношений →
  // per-node сцены DialogueUnit-графа. Диалог не знает о перемещении:
  // choices несут ТОЛЬКО собственные эффекты (rel-дельты/флаги), а
  // движенческие эффекты {met: 1, phase: +1} живут на единственном
  // auto-advance выходе closing-узлов — это и есть closing-переход
  // encounter-обёртки, единственная дорога назад.
  function wireEncounter(
    encRouterId: string,
    liId: string,
    met: string,
    unitsRaw: DialogueUnit[],
    locId: string,
    extraClosingDeltas: Record<string, number> = {},
    opts: { closingTarget?: string } = {},
  ): void {
    // Разговор списывает ФАЗУ, а не слот: большую стрелку двигает только сюжет
    // (бит или якорный переход). Плейтест показал цену прежнего тарифа —
    // беседа начиналась вечером, а после прощания наступало утро.
    //
    // Возврат — через enter-роутер, а не сразу в хаб: бит, созревший за время
    // разговора, обязан выстрелить в том же слоте (роутер битов живёт там).
    const returnTarget = opts.closingTarget ?? enterId(locId);
    const routerNode: GameSceneNode = {
      id: encRouterId,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs: [], sceneType: 'router' },
    };
    nodes.push(routerNode);

    // Безусловный neutral обязан идти последним — роутер берёт первое активное.
    const units = [...unitsRaw].sort((a, b) => BRACKET_WIRE_ORDER[a.bracket] - BRACKET_WIRE_ORDER[b.bracket]);

    // Closing-переход: встреча состоялась (+ unit[<id>] и establishes-флаги,
    // когда встреча — юнит пула событий), малая стрелка сдвинулась на фазу.
    const movementEffects: Record<string, number> = {
      [met]: 1,
      [PHASE_VAR]: 1,
      ...extraClosingDeltas,
    };

    const audioProfile = buildSceneAudioProfile(liId, audio.byLi[liId]);

    for (const unit of units) {
      const condition = bracketCondition(liId, unit.bracket, bracketThresholdsOf(liId));

      const nodeIdMap = new Map<string, string>();
      for (const un of unit.nodes) {
        nodeIdMap.set(un.id, uniqueId(`${encRouterId}_${un.id}`));
      }

      const routerOutId = uniqueId(`${encRouterId}__${unit.bracket}`);
      routerNode.data.outputs.push({ id: routerOutId, text: '' });
      const condEdge: GameSceneEdge = {
        id: `e_${routerOutId}`,
        source: encRouterId,
        sourceHandle: routerOutId,
        target: nodeIdMap.get(unit.entryNodeId) ?? unit.entryNodeId,
      };
      if (condition.length > 0) condEdge.condition = condition;
      edges.push(condEdge);

      for (const un of unit.nodes) {
        const unId = nodeIdMap.get(un.id)!;
        dialogueSceneCount++;

        const draft = nodeAsDraftScene(un);
        const positions = assignPositions(un.charactersPresent.length);
        const sprites: GameSpriteEntry[] = [];
        const spriteIndexByChar = new Map<string, number>();
        for (let ci = 0; ci < un.charactersPresent.length; ci++) {
          const charId = un.charactersPresent[ci];
          const emotion = pickCharacterEmotion(draft, charId);
          const { url } = resolveEmotionToSpriteUrl(characters[charId], emotion);
          if (url) {
            spriteIndexByChar.set(charId, sprites.length);
            sprites.push({ url, position: positions[ci] ?? 'center' });
          }
        }

        // Пер-строчный трек: спрайт говорящего следует эмоции ЕГО реплики,
        // остальные персонажи держат эмоцию узла. Узловые sprites остаются
        // фолбэком для плееров без поддержки lines.
        const baseSprites = sprites.length ? sprites : undefined;
        const spritesForLine = (dl: typeof un.dialogue[number]): GameSpriteEntry[] | undefined => {
          const si = spriteIndexByChar.get(dl.speaker);
          if (si === undefined) return baseSprites;
          const emotion = dl.emotion || pickCharacterEmotion(draft, dl.speaker);
          const { url } = resolveEmotionToSpriteUrl(characters[dl.speaker], emotion);
          if (!url || url === sprites[si].url) return baseSprites;
          return sprites.map((s, i) => (i === si ? { ...s, url } : s));
        };

        const sceneLines: GameSceneLineEntry[] = [];
        const narrationText = escapeNL(un.narration);
        if (narrationText) {
          // Нарратив узла — сценическая ремарка к ПЕРВОЙ реплике («её голос
          // становится мягче…»), поэтому наследует её позу, а не узловую.
          const firstLine = un.dialogue[0];
          sceneLines.push({
            text: narrationText,
            sprites: firstLine ? spritesForLine(firstLine) : baseSprites,
          });
        }
        for (const dl of un.dialogue) {
          sceneLines.push({
            speaker: liNameById.get(dl.speaker) ?? dl.speaker,
            text: dl.line,
            sprites: spritesForLine(dl),
          });
        }

        const unOutputs: GameSceneOutput[] = [];
        if (un.choices.length === 0) {
          // Closing-узел (валидатор гарантирует closing===true у листьев;
          // дефектный лист компилируется так же — обрыв в хаб хуже).
          // Единственный auto-advance несёт ВСЕ движенческие эффекты.
          const autoId = uniqueId(`${unId}__auto`);
          unOutputs.push({ id: autoId, text: '', effects: { stateDeltas: { ...movementEffects } } });
          edges.push({ id: `e_${autoId}`, source: unId, sourceHandle: autoId, target: returnTarget });
        } else {
          for (const c of un.choices) {
            const cId = uniqueId(c.id);
            // ТОЛЬКО собственные эффекты выбора: rel-дельты и флаги.
            const deltas = { ...c.effects.stateDeltas };
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
            unOutputs.push(out);
            edges.push({
              id: `e_${cId}`,
              source: unId,
              sourceHandle: cId,
              // Все переходы выборов — ВНУТРИ юнита (валидатор гарантирует
              // существование цели; сырой next — детерминированный фолбэк).
              target: nodeIdMap.get(c.next) ?? c.next,
            });
          }
        }

        nodes.push({
          id: unId,
          type: 'scene',
          position: { x: 0, y: 0 },
          data: {
            label: renderDraftSceneText(un.narration, un.dialogue, id => liNameById.get(id) ?? id),
            image: bgForLocation(locId),
            sprite: sprites[0]?.url,
            sprites: sprites.length ? sprites : undefined,
            lines: sceneLines.length ? sceneLines : undefined,
            outputs: unOutputs,
            sceneType: un.choices.length === 0 ? 'narration' : 'dialogue',
            audioProfile,
            sfxUrl: resolveSfxUrl(pickCharacterEmotion(draft, liId), audio.sfx),
          },
        });
      }
    }

    // Страховка от ROUTER_DEAD_END при отсутствии neutral-юнита.
    const hasUnconditional = units.some(u => bracketCondition(liId, u.bracket).length === 0);
    if (!hasUnconditional) {
      const fallbackId = uniqueId(`${encRouterId}__fallback`);
      routerNode.data.outputs.push({ id: fallbackId, text: '' });
      edges.push({ id: `e_${fallbackId}`, source: encRouterId, sourceHandle: fallbackId, target: returnTarget });
    }
  }

  // ── 3. Старт: интро-нарратив → enter первой локации ──────────────────
  // enter (а не hub): бит со слот-окном от 0 стреляет сразу.
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
        // H-компонента: affection можно накопить болтовнёй, а вершину арки —
        // только сыграв. Гейтим лишь тех, чья вершина реально проведена (иначе
        // концовка требовала бы флаг, который никто не ставит).
        if (peakWiredLis.has(e.liId)) conds.push({ path: flagVar(arcPeakFlag(e.liId)), gte: 1 });
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
        phasesPerSlot: PHASES_PER_SLOT,
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
      branchPoints: spine.beats.filter(b => b.kind === 'branchPoint').length,
      branchExclusiveBeats: spine.beats.filter(b => guardFlags(b.guard).some(f => outcomeFlags.has(f))).length,
    },
  };
}
