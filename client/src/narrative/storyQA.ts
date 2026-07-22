import type { Brief, EndingVariant, SegmentIssue, WorldModel } from './types';
import { endingKey } from './types';
import type { Calendar, CastPlan, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { PHASES_PER_SLOT, slotLabel } from './calendarTypes';
import type { Guard } from './events';
import { guardFiredIds } from './events';
import { StoryletDirector, type CompiledBeat, type Effect } from 'gu-engine-story-core';
import { buildStoryletBundle } from './buildStoryletBundle';
import { DIALOGUE_UNIT_MAX_DEPTH } from './dialogueUnit';
import { enumerateLeafAssignments, guardFlags, playableBeatsForLeaf, validateSpine } from './validateSpine';
import { validateCalendar } from './validateCalendar';
import { validateSchedule } from './buildSchedule';
import { unitEstablishes, validateEventUnits } from './parseEventPool';
import { computeReachableUnits, computeReachableUnitsFor } from './reachability';
import { assignBeatSlots } from './beatSchedule';
import { skipsNegativeBracket } from './ladderGuards';
import { coverageIssues } from './coverageUnits';
import type { DialogueUnit } from './dialogueUnit';
import { validateDialogueUnit } from './dialogueUnit';
import type { DialogueVariantBracket } from './types';

/**
 * Story QA (фаза 6 docs/plans/calendar-branching.md):
 *   - D2 runStoryQAStructural — структурный отчёт без LLM: реран
 *     per-artifact валидаторов + кросс-артефактные проверки, которыми
 *     не владеет ни один из них (покрытие прозой, флаги-призраки,
 *     мёртвый контент по листьям);
 *   - D3 simulatePolicies — детерминированный прогон N политик игрока
 *     по evaluateSlice: каждая политика обязана достигать финала и
 *     хотя бы одной концовки;
 *   - D4 buildStoryLeafQARequests — payload-ы для LLM-критика листьев
 *     (лента summary битов одного листа, ≤8 вызовов).
 *
 * Всё детерминировано: одинаковые входы дают одинаковый отчёт, поэтому
 * QA дёшево перезапускается после каждой правки артефактов.
 */

export type StoryQAInputs = {
  brief: Brief;
  calendar: Calendar;
  spine: SpinePlan;
  schedule: CharacterSchedule;
  castPlan: CastPlan | null;
  tagMap: Record<string, string[]> | null;
  worldModel: WorldModel | null;
  eventUnits: EventUnit[];
  unitProse: Record<string, DialogueUnit[]>;
};

const BRACKETS: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];

/** Слишком много листьев = развилки за бюджетом; переборные проверки скипаем. */
const MAX_LEAVES = 32;

const prefixed = (prefix: string, issues: SegmentIssue[]): SegmentIssue[] =>
  issues.map(i => ({ ...i, scope: `${prefix}${i.scope}` }));

// ============================================================================
// D2 — СТРУКТУРНЫЙ ОТЧЁТ (без LLM)
// ============================================================================

/**
 * Агрегатор: реран per-artifact валидаторов (scope-префиксы spine/, calendar/,
 * schedule/, units/, dialogue/<unitId>/) + кросс-артефактные проверки:
 *   - покрытие прозой: у каждого ДОСТИЖИМОГО диалогового юнита ровно 3
 *     структурно валидных брекета (error — кнопка не появится в игре);
 *   - orphan-проза: ключ unitProse без юнита (warning);
 *   - флаги-призраки: флаг, требуемый битом/концовкой/юнитом, но не
 *     устанавливаемый НИЧЕМ по union всех источников (error — validateSpine
 *     видит только спайновые establish-ы, юниты для него невидимы);
 *   - мёртвый контент: юниты, недостижимые при КАЖДОМ листе веток (warning).
 */
export function runStoryQAStructural(inputs: StoryQAInputs): SegmentIssue[] {
  const { brief, calendar, spine, schedule, castPlan, tagMap, worldModel, eventUnits, unitProse } = inputs;
  const issues: SegmentIssue[] = [];

  // ── Реран per-artifact валидаторов. ───────────────────────────────────────
  // Юниты — чтобы валидатор видел тот же граф, что компилятор: гейты головы
  // линии указывают на встречи, а не только на биты.
  issues.push(...prefixed('spine/', validateSpine(spine, calendar, brief, worldModel, eventUnits)));
  issues.push(...prefixed('calendar/', validateCalendar(calendar, brief, worldModel, tagMap, castPlan)));
  issues.push(...prefixed('schedule/', validateSchedule(schedule, spine, calendar, brief)));
  issues.push(...prefixed('units/', validateEventUnits(eventUnits, brief, calendar, spine, schedule)));
  // Обратное покрытие (расписание → юнит): validateEventUnits меряет только
  // «юнит там, где персонаж бывает», из-за чего слот с LI и без единой встречи
  // оставался немым (игрок в кафе не мог заговорить с Юки).
  issues.push(...coverageIssues(spine, calendar, schedule, eventUnits));

  const unitById = new Map(eventUnits.map(u => [u.id, u]));
  for (const [unitId, dialogues] of Object.entries(unitProse)) {
    const owner = unitById.get(unitId);
    for (const d of dialogues) {
      const liId = owner?.participants[0] ?? d.liId;
      issues.push(...prefixed(`dialogue/${unitId}/`, validateDialogueUnit(d, liId)));
    }
  }

  // ── Покрытие прозой достижимых диалоговых юнитов. ─────────────────────────
  const reachable = computeReachableUnits(spine, calendar, eventUnits);
  for (const unit of eventUnits) {
    if (unit.kind !== 'dialogue' || !reachable.has(unit.id)) continue;
    const prose = unitProse[unit.id] ?? [];
    const liId = unit.participants[0] ?? '';
    for (const bracket of BRACKETS) {
      // Тот же предикат, что у раннера: холодную прозу для ступени, куда
      // холодным не войти, мы намеренно не генерим. Не знай QA об этом — он
      // требовал бы её и гонял перегенерацию по кругу.
      if (bracket === 'negative' && skipsNegativeBracket(unit, brief, calendar, eventUnits)) continue;

      const d = prose.find(p => p.bracket === bracket);
      if (!d) {
        issues.push({
          severity: 'error',
          scope: `qa/prose/${unit.id}`,
          message: `достижимый юнит без прозы (bracket=${bracket}) — кнопка не появится в игре`,
        });
        continue;
      }
      if (validateDialogueUnit(d, liId).some(i => i.severity === 'error')) {
        issues.push({
          severity: 'error',
          scope: `qa/prose/${unit.id}`,
          message: `проза юнита (bracket=${bracket}) структурно невалидна — кнопка не появится в игре`,
        });
      }
    }
  }

  // ── Orphan-проза: ключи без юнита. ────────────────────────────────────────
  for (const unitId of Object.keys(unitProse)) {
    if (!unitById.has(unitId)) {
      issues.push({
        severity: 'warning',
        scope: `qa/prose/${unitId}`,
        message: `проза без юнита в пуле событий — мёртвый кэш (юнит удалён или переименован)`,
      });
    }
  }

  // ── Флаги-призраки: union establish-источников по ВСЕМ артефактам. ────────
  const establishedByAny = new Set<string>();
  for (const b of spine.beats) {
    for (const f of b.establishes) establishedByAny.add(f);
    for (const o of b.outcomes ?? []) establishedByAny.add(o.setsFlag);
  }
  for (const u of eventUnits) for (const f of unitEstablishes(u)) establishedByAny.add(f);

  const requiredBy = new Map<string, string[]>();
  const noteRequired = (guard: Guard, source: string) => {
    for (const f of guardFlags(guard)) {
      const list = requiredBy.get(f) ?? [];
      list.push(source);
      requiredBy.set(f, list);
    }
  };
  for (const b of spine.beats) noteRequired(b.guard, `бит "${b.id}"`);
  for (const e of spine.endings) noteRequired(e.guard, `концовка "${e.id}"`);
  for (const u of eventUnits) noteRequired(u.guard, `юнит "${u.id}"`);

  for (const [flag, sources] of requiredBy) {
    if (establishedByAny.has(flag)) continue;
    issues.push({
      severity: 'error',
      scope: `qa/flags/${flag}`,
      message: `флаг "${flag}" требуется (${sources.slice(0, 3).join(', ')}${
        sources.length > 3 ? ` и ещё ${sources.length - 3}` : ''
      }), но не устанавливается ничем — ни битом, ни исходом, ни юнитом`,
    });
  }

  // ── Мёртвый контент: юниты, недостижимые на КАЖДОМ листе. ────────────────
  const leaves = enumerateLeafAssignments(spine);
  if (leaves.length <= MAX_LEAVES) {
    const reachableUnion = new Set<string>();
    for (const leaf of leaves) {
      for (const id of computeReachableUnitsFor(spine, calendar, eventUnits, leaf.assignment)) {
        reachableUnion.add(id);
      }
    }
    const dead = eventUnits.filter(u => !reachableUnion.has(u.id));
    if (dead.length > 0) {
      issues.push({
        severity: 'warning',
        scope: 'qa/deadContent',
        message: `${dead.length} юнитов недостижимы при любом листе веток — мёртвый контент: ${dead
          .slice(0, 5)
          .map(u => u.id)
          .join(', ')}${dead.length > 5 ? '…' : ''}`,
      });
    }
  }

  return issues;
}

// ============================================================================
// D3 — СИМУЛЯЦИЯ ПОЛИТИК (без LLM)
// ============================================================================

export type StoryQAState = 'idle' | 'running' | 'done';

/** Статус/отчёт Story QA. Живёт в narrativeStore и переживает переходы и reload. */
export type StoryQAStatus = {
  state: StoryQAState;
  issues: SegmentIssue[];
  policyReports: PolicyReport[];
};

export type PolicyReport = {
  policy: string;
  /** Seed прогона: селектор стохастичен, отчёт обязан быть воспроизводим. */
  seed: number;
  reachedFinale: boolean;
  /** id первой выполнимой концовки (evalGuard по финальному состоянию), иначе null. */
  endingSatisfied: string | null;
  firedBeats: string[];
  firedUnits: string[];
  /** Слоты, где политика посетила локацию, но ничего не сработало. */
  deadSlots: number[];
  /**
   * Разговоров сыграно за прогон. Пейсинг после отмены слот-тарифа не тюним
   * вслепую: встречи больше не конкурируют с битами за слоты, плотность
   * контента на день выросла — сначала смотрим на реальные цифры.
   */
  actsPlayed: number;
  /** affection героини по LI на конец прогона. */
  relFinal: Record<string, number>;
  slotCount: number;
  /** Биты, сыгранные раньше своего предшественника по цепочке (обязано быть пусто). */
  orderViolations?: string[];
  /**
   * Юниты, которых селектор не предложил ни при одной политике и seed-е —
   * оплаченная проза, которую игрок не увидит. Заполняется один раз на прогон
   * (в первом отчёте), потому что считается по всем политикам сразу.
   */
  starvedUnits?: string[];
};

/**
 * Seed-ы симуляции. Селектор тянет жребий, поэтому одиночный прогон мог бы
 * случайно не заметить голодающий контент; фиксированный набор держит отчёт
 * воспроизводимым.
 */
const SIM_SEEDS = [1, 2, 3];

/**
 * Дефолтные политики; 'greedy-li:*' разворачивается в одну политику на
 * каждого LI брифа внутри simulatePolicies.
 */
export const DEFAULT_POLICIES = [
  'spine-only',
  'greedy-li:*',
  // Прилежный тёплый игрок — верхняя граница: ловит НЕдоходимую арку там, где
  // пессимистичные политики просто молчат.
  'warm-li:*',
  'round-robin',
  'seeded-random:1',
  'seeded-random:2',
];

/** FNV-1a-подобный детерминированный хэш (та же идея, что в buildSchedule). */
function policyHash(key: string, slot: number, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= slot + 0x9e3779b9;
  h = Math.imul(h, 16777619);
  return h >>> 0;
}

/**
 * Политика игрока поверх ПУБЛИЧНОГО API режиссёра.
 *
 * Раньше политики говорили с evaluateSlice — вторым исполнителем правил,
 * который компилятор потом переводил в граф. Теперь они играют ровно то, что
 * увидит игрок: тот же StoryletDirector, тот же селектор, те же брекеты и
 * продолжения. Поэтому «QA зелёный, а игра не проходится» стало невозможно
 * по построению, а не по внимательности.
 */
type PlayerPolicy = {
  name: string;
  /** Куда идти, когда здесь пусто. null — двигать время якорем. */
  pickLocation: (d: StoryletDirector, moves: string[]) => string | null;
  /** С кем говорить из предложенного селектором. null — ни с кем. */
  pickTalk: (talks: Array<{ unitId: string; li: string }>) => string | null;
  /** Как отвечать в сцене: 'warm' — максимум близости, 'cold' — минимум. */
  tone: 'warm' | 'cold';
  pickOutcome: (beat: CompiledBeat) => string | undefined;
  /** Продолжать ли посиделку следующей ступенью. */
  takeContinuation: boolean;
};

function buildPolicies(liIds: string[], names: string[]): PlayerPolicy[] {
  const firstOutcome = (beat: CompiledBeat): string | undefined => beat.outcomes?.[0]?.id;

  /** Куда идти за конкретным человеком: ближайший шаг к его локации. */
  const towardLi =
    (liId: string) =>
    (d: StoryletDirector, moves: string[]): string | null => {
      const want = d.bundle.schedule[liId]?.[d.slot] ?? null;
      if (want && want !== d.location) {
        if (moves.includes(want)) return want;
        // Не сосед — идём общим маршрутом к содержимому (BFS без побочных эффектов).
        const route = d.routeToContent();
        if (route.length > 0) return route[0];
      }
      return null;
    };

  const build = (name: string): PlayerPolicy => {
    if (name === 'spine-only') {
      return {
        name,
        // Только сюжет: идём туда, где созрел бит, и ни с кем не говорим.
        pickLocation: d => {
          const beat = d.bundle.spine.beats.find(
            b => !d.slice.fired.some(f => f.eventId === b.id) && d.maturedBeat(b.locationId)?.id === b.id,
          );
          if (!beat || beat.locationId === d.location) return null;
          const route = d.routeToContent();
          return route.length > 0 ? route[0] : null;
        },
        pickTalk: () => null,
        tone: 'cold',
        pickOutcome: firstOutcome,
        takeContinuation: false,
      };
    }
    if (name.startsWith('greedy-li:') || name.startsWith('warm-li:')) {
      // greedy — пессимистичная граница (холодные ответы): «нельзя ли
      // проскочить ступень нахрапом». warm — прилежный игрок: «доходима ли
      // арка вообще». Нужны обе.
      const warm = name.startsWith('warm-li:');
      const liId = name.slice(name.indexOf(':') + 1);
      return {
        name,
        pickLocation: towardLi(liId),
        pickTalk: talks => talks.find(t => t.li === liId)?.unitId ?? null,
        tone: warm ? 'warm' : 'cold',
        pickOutcome: firstOutcome,
        takeContinuation: true,
      };
    }
    if (name === 'round-robin') {
      return {
        name,
        pickLocation: (d, moves) => (liIds.length > 0 ? towardLi(liIds[d.slot % liIds.length])(d, moves) : null),
        pickTalk: talks => talks[0]?.unitId ?? null,
        tone: 'warm',
        pickOutcome: firstOutcome,
        takeContinuation: true,
      };
    }
    if (name.startsWith('seeded-random:')) {
      const seed = Number(name.slice('seeded-random:'.length)) || 0;
      return {
        name,
        pickLocation: (d, moves) => {
          if (moves.length === 0) return null;
          const route = d.routeToContent();
          if (route.length > 0) return route[0];
          return moves[policyHash(name, d.slot, seed) % moves.length];
        },
        pickTalk: talks => (talks.length === 0 ? null : talks[policyHash(name, 0, seed) % talks.length].unitId),
        tone: seed % 2 === 0 ? 'warm' : 'cold',
        pickOutcome: beat =>
          beat.outcomes && beat.outcomes.length > 0
            ? beat.outcomes[policyHash(beat.id, 0, seed) % beat.outcomes.length].id
            : undefined,
        takeContinuation: true,
      };
    }
    // Неизвестное имя — политика «стоять на месте» (отчёт честно провалится).
    return {
      name,
      pickLocation: () => null,
      pickTalk: () => null,
      tone: 'cold',
      pickOutcome: firstOutcome,
      takeContinuation: false,
    };
  };

  return names
    .flatMap(n => {
      if (n === 'greedy-li:*') return liIds.map(id => `greedy-li:${id}`);
      if (n === 'warm-li:*') return liIds.map(id => `warm-li:${id}`);
      return [n];
    })
    .map(build);
}

/** Суммарная дельта affection выбора — по ней политика и отыгрывает тон. */
function choiceAffection(choice: { effects: Effect[] }): number {
  let sum = 0;
  for (const e of choice.effects) if ('rel' in e && e.rel.var === 'affection') sum += e.rel.delta;
  return sum;
}

/** Проигрывает открытую сцену до закрывающего узла, отвечая в заданном тоне. */
function playScene(d: StoryletDirector, tone: 'warm' | 'cold'): void {
  let node = d.currentNode();
  let depth = 0;
  while (node && node.choices.length > 0 && depth++ < DIALOGUE_UNIT_MAX_DEPTH + 2) {
    const sorted = [...node.choices].sort((a, b) => choiceAffection(a) - choiceAffection(b));
    const pick = tone === 'warm' ? sorted[sorted.length - 1] : sorted[0];
    node = d.choose(pick.id);
  }
}

/**
 * Прогон детерминированных политик игрока ПО НАСТОЯЩЕМУ РЕЖИССЁРУ.
 *
 * Бандл собирается в памяти тем же buildStoryletBundle, что уходит в экспорт
 * (с заглушками вместо ненаписанной прозы — QA судит структуру, а не текст), и
 * политики играют его через публичный API StoryletDirector. Симуляция и игра
 * больше не два исполнителя одних правил, а один и тот же класс: расхождение
 * между «QA зелёный» и «игра не проходится» невозможно по построению.
 *
 * Каждая политика гоняется по нескольким seed-ам: селектор стохастичен, и
 * одиночный прогон мог бы случайно не заметить голодающий контент.
 *
 * Утверждения живут в ОТЧЁТЕ (см. summarizePolicyReports), не бросаются.
 */
export function simulatePolicies(inputs: StoryQAInputs, policies: string[] = DEFAULT_POLICIES): PolicyReport[] {
  const { brief, calendar, worldModel, spine, schedule, eventUnits, unitProse, tagMap } = inputs;
  // Без модели мира симуляции нет: режиссёр ходит по карте. Молча вернуть
  // пустой отчёт нельзя — QA выглядел бы зелёным именно тогда, когда он вообще
  // ничего не проверил; summarizePolicyReports превращает это в error.
  if (!worldModel || worldModel.locations.length === 0) return [];

  const liIds = brief.loveInterests.map(li => li.id);
  const slotCount = calendar.slotCount;

  // Концовки-заглушки: компилятор берёт в бандл только те, для которых есть
  // проза, а QA обязан судить достижимость концовок ЕЩЁ ДО её генерации.
  // Иначе endingSatisfied всегда null и каждая политика ложно проваливается.
  const stubEndings: Record<string, EndingVariant> = Object.fromEntries(
    spine.endings.map(e => [
      endingKey(e.kind, e.liId),
      { kind: e.kind, liId: e.liId, scenes: [{ id: '', narration: `[без прозы: концовка ${e.id}]` }] },
    ]),
  );

  // Тот же сборщик, что и в экспорте: лестница и цепочка битов применяются
  // внутри него, поэтому QA видит ровно те гейты, что попадут в игру.
  const { bundle } = buildStoryletBundle(
    brief,
    spine,
    calendar,
    schedule,
    worldModel,
    {},
    unitProse,
    Object.fromEntries(eventUnits.map(u => [u.id, u])),
    stubEndings,
    {},
    {},
    undefined,
    { tagMap },
    { stubMissingProse: true },
  );

  const offeredEver = new Set<string>();
  const reports: PolicyReport[] = [];

  for (const policy of buildPolicies(liIds, policies)) {
    for (const seed of SIM_SEEDS) {
      const d = new StoryletDirector(bundle, { seed });
      const firedBeats: string[] = [];
      const firedUnits: string[] = [];
      const deadSlots = new Set<number>();
      let actsPlayed = 0;

      // Потолок шагов: слоты × фазы × запас на ходьбу. Страховка от политики,
      // которая ходит кругами и никуда не приходит.
      const maxSteps = slotCount * (calendar.slotCount > 0 ? PHASES_PER_SLOT : 1) * 8 + 64;
      let steps = 0;
      let progressedThisSlot = false;
      let watchedSlot = d.slot;

      // shouldEnd, а не finaleFired: проспавшая сюжет политика упирается в
      // конец календаря — с гарантией анти-софтлока это штатная концовка, и
      // крутить пустые шаги до maxSteps незачем.
      while (!d.shouldEnd() && steps++ < maxSteps) {
        if (d.slot !== watchedSlot) {
          if (!progressedThisSlot) deadSlots.add(watchedSlot);
          watchedSlot = d.slot;
          progressedThisSlot = false;
        }

        const beat = d.maturedBeat();
        if (beat) {
          d.completeBeat(beat.id, beat.kind === 'branchPoint' ? policy.pickOutcome(beat) : undefined);
          firedBeats.push(beat.id);
          progressedThisSlot = true;
          continue;
        }

        const actions = d.hubActions();
        for (const t of actions.talks) offeredEver.add(t.unitId);

        const talkId = policy.pickTalk(actions.talks);
        if (talkId && d.startTalk(talkId)) {
          playScene(d, policy.tone);
          firedUnits.push(talkId);
          actsPlayed++;
          progressedThisSlot = true;
          let close = d.closeTalk();
          while (policy.takeContinuation && close.continuation) {
            const nextId = close.continuation.unitId;
            if (!d.startTalk(nextId)) break;
            playScene(d, policy.tone);
            firedUnits.push(nextId);
            actsPlayed++;
            close = d.closeTalk();
          }
          continue;
        }

        const moveIds = actions.moves.map(m => m.locationId);
        const target = policy.pickLocation(d, moveIds);
        if (target && moveIds.includes(target)) {
          d.moveTo(target);
          continue;
        }
        d.anchorAdvance();
      }
      if (!progressedThisSlot && d.slot < slotCount) deadSlots.add(watchedSlot);

      const ending = d.checkEnding();

      // Регресс-страховка порядка: бит не может опередить предшественника по
      // fired-цепочке — движок гейтит его guard-ом, а не надеждой.
      const orderIndex = new Map(firedBeats.map((id, i) => [id, i]));
      const beatIds = new Set(bundle.spine.beats.map(b => b.id));
      const orderViolations: string[] = [];
      for (const b of bundle.spine.beats) {
        const at = orderIndex.get(b.id);
        if (at == null) continue;
        for (const dep of guardFiredIds(b.guard)) {
          if (!beatIds.has(dep)) continue;
          const depAt = orderIndex.get(dep);
          if (depAt == null || depAt > at) orderViolations.push(`${b.id} до ${dep}`);
        }
      }

      reports.push({
        policy: policy.name,
        seed,
        reachedFinale: d.finaleFired(),
        endingSatisfied: ending?.id ?? null,
        firedBeats,
        firedUnits,
        deadSlots: [...deadSlots].sort((a, b) => a - b),
        actsPlayed,
        relFinal: Object.fromEntries(liIds.map(id => [id, d.slice.relationships[id]?.affection ?? 0])),
        slotCount,
        orderViolations,
      });
    }
  }

  // Юниты, которых селектор не предложил НИ РАЗУ ни при одной политике и
  // seed-е: оплаченная проза, которую игрок не увидит. Это сигнал голодания,
  // а не ошибка — поэтому едет отдельным полем, а не в reachedFinale.
  const starved = bundle.units.map(u => u.id).filter(id => !offeredEver.has(id));
  if (reports.length > 0) reports[0].starvedUnits = starved;

  return reports;
}

/** Отчёты политик → issues: провал финала/концовки = error, мёртвые слоты = warning. */
export function summarizePolicyReports(reports: PolicyReport[]): SegmentIssue[] {
  const issues: SegmentIssue[] = [];

  // Пустой отчёт = симуляция не запускалась (нет модели мира). Это ошибка, а
  // не «всё хорошо»: зелёный QA без единого прогона обманчивее красного.
  if (reports.length === 0) {
    return [
      {
        severity: 'error',
        scope: 'sim',
        message: 'симуляция не запускалась — нет модели мира; проходимость истории не проверена',
      },
    ];
  }

  // Провал финала/концовки — свойство ПОЛИТИКИ, а не отдельного seed-а:
  // ругаться на каждый seed значило бы утроить один и тот же issue.
  const bySeedGroups = new Map<string, PolicyReport[]>();
  for (const r of reports) {
    const list = bySeedGroups.get(r.policy) ?? [];
    list.push(r);
    bySeedGroups.set(r.policy, list);
  }
  for (const [policy, runs] of bySeedGroups) {
    const failedFinale = runs.filter(r => !r.reachedFinale);
    if (failedFinale.length === runs.length) {
      issues.push({
        severity: 'error',
        scope: `sim/${policy}`,
        message: `политика не достигает финала ни на одном seed (${runs.length}) за ${runs[0].slotCount} слотов`,
      });
    } else if (failedFinale.length > 0) {
      // Часть seed-ов не дошла — история проходима, но зависит от жребия.
      issues.push({
        severity: 'warning',
        scope: `sim/${policy}`,
        message: `финал достигается не всегда: провал на seed ${failedFinale.map(r => r.seed).join(', ')}`,
      });
    }
  }

  const starved = reports.find(r => r.starvedUnits)?.starvedUnits ?? [];
  if (starved.length > 0) {
    issues.push({
      severity: 'warning',
      scope: 'sim/selector',
      message:
        `селектор ни разу не предложил ${starved.length} сцен ни при одной политике и seed-е ` +
        `(${starved.slice(0, 5).join(', ')}${
          starved.length > 5 ? ', …' : ''
        }) — оплаченная проза, которую игрок не увидит`,
    });
  }

  for (const r of reports) {
    if (r.endingSatisfied == null) {
      issues.push({
        severity: 'error',
        scope: `sim/${r.policy}#${r.seed}`,
        message: 'ни одна концовка не выполнима финальным состоянием прогона',
      });
    }
    if (r.deadSlots.length > r.slotCount / 3) {
      issues.push({
        severity: 'warning',
        scope: `sim/${r.policy}#${r.seed}`,
        message: `мёртвых слотов ${r.deadSlots.length} из ${r.slotCount} (>1/3) — игрок часто приходит в пустоту`,
      });
    }
    if (r.orderViolations && r.orderViolations.length > 0) {
      issues.push({
        severity: 'error',
        scope: `sim/${r.policy}#${r.seed}`,
        message: `порядок битов нарушен: ${r.orderViolations.join(', ')} — цепочка не доехала до симуляции`,
      });
    }
  }
  return issues;
}

// ============================================================================
// D4 — PAYLOAD-Ы ДЛЯ LLM-КРИТИКА ЛИСТЬЕВ
// ============================================================================

export type StoryLeafQAPayload = {
  leafLabel: string;
  beatSummariesOrdered: { id: string; summary: string; timeMarker: string }[];
  endings: { id: string; kind: string; summary?: string }[];
  briefTone: string;
};

/** Бюджет вызовов критика листьев (план: ≤8 при бюджете 2 развилок). */
export const MAX_LEAF_QA_CALLS = 8;

/**
 * Лента битов каждого листа в порядке назначенных слотов + концовки + тон
 * брифа. Листьев больше бюджета — берём первые MAX_LEAF_QA_CALLS
 * (детерминированный порядок enumerateLeafAssignments).
 */
export function buildStoryLeafQARequests(inputs: StoryQAInputs): StoryLeafQAPayload[] {
  const { brief, calendar, spine } = inputs;
  const beatSlots = assignBeatSlots(spine, calendar);
  const slotOfBeat = (b: SpineBeat): number => beatSlots[b.id] ?? Math.max(0, b.window.fromSlot);
  const beatById = new Map(spine.beats.map(b => [b.id, b]));
  const tone = brief.world.tone;
  const briefTone = `${tone.mood}; темы: ${tone.themes.join(', ')}; интенсивность ${tone.intensity}`;

  return enumerateLeafAssignments(spine)
    .slice(0, MAX_LEAF_QA_CALLS)
    .map(leaf => {
      const { played, earliest } = playableBeatsForLeaf(spine, calendar, leaf.assignment);
      const beats = [...played]
        .map(id => beatById.get(id)!)
        .sort((a, b) => slotOfBeat(a) - slotOfBeat(b) || (a.id < b.id ? -1 : 1));
      // Критику отдаются только концовки, достижимые НА ЭТОМ листе: чужие
      // (требующие флаги невыбранных исходов) провоцируют ложные
      // «противоречия выбору». Пустой список (лист без концовок — отдельная
      // error validateSpine) деградирует в полный, чтобы не слепить критика.
      const reachableEndings = spine.endings.filter(e => guardFlags(e.guard).every(f => earliest.has(f)));
      const endingsForLeaf = reachableEndings.length > 0 ? reachableEndings : spine.endings;
      return {
        leafLabel: leaf.label || 'единственный лист',
        beatSummariesOrdered: beats.map(b => {
          const chosen = leaf.assignment[b.id];
          const outcome = chosen ? b.outcomes?.find(o => o.id === chosen) : null;
          return {
            id: b.id,
            summary: outcome ? `${b.summary} [исход: ${outcome.summary || outcome.label}]` : b.summary,
            timeMarker: slotLabel(slotOfBeat(b), calendar),
          };
        }),
        endings: endingsForLeaf.map(e => ({
          id: e.id,
          kind: e.kind,
          summary: `${e.liId ? `LI: ${e.liId}; ` : ''}требует: [${guardFlags(e.guard).join(', ')}]`,
        })),
        briefTone,
      };
    });
}
