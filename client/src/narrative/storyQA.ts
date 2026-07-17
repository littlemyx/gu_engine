import type { Brief, SegmentIssue, WorldModel } from './types';
import type {
  Calendar,
  CastPlan,
  CharacterSchedule,
  EventUnit,
  SpineBeat,
  SpineBeatOutcome,
  SpinePlan,
} from './calendarTypes';
import { PHASES_PER_SLOT, slotLabel } from './calendarTypes';
import type { EventDef, Guard, SliceState } from './events';
import { DEFAULT_RELATIONSHIP, createSliceState, evalGuard, evaluateSlice, guardFiredIds } from './events';
import { enumerateLeafAssignments, guardFlags, playableBeatsForLeaf, validateSpine } from './validateSpine';
import { validateCalendar } from './validateCalendar';
import { validateSchedule } from './buildSchedule';
import { unitEstablishes, validateEventUnits } from './parseEventPool';
import { computeReachableUnits, computeReachableUnitsFor } from './reachability';
import { assignBeatSlots } from './beatSchedule';
import { applyBeatChain } from './beatChain';
import { applyLadderGuards, skipsNegativeBracket } from './ladderGuards';
import { CHOICE_PATH_DELTA_CAP } from './calendarTypes';
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
};

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

const BEAT_DEF_PREFIX = 'beat:';

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

type PolicyImpl = {
  name: string;
  pickLocation: (slot: number, firedBeatIds: Set<string>) => string | null;
  pickOutcome: (beat: SpineBeat) => SpineBeatOutcome | null;
  /**
   * Как игрок ведёт себя В диалоге: выборы дают ±CHOICE_PATH_DELTA_CAP за
   * встречу. Симулятор не проигрывает диалоговые графы, поэтому канал выборов
   * моделируется одним числом на встречу.
   *
   * 0 (по умолчанию) — пессимистично, только детерминированные closing-гейны:
   * такой прогон честно отвечает «нельзя ли проскочить ступень нахрапом».
   * +cap («warm-li») — прилежный игрок: отвечает «доходима ли арка вообще».
   * Обе границы нужны: одна ловит скачок, другая — тупик.
   */
  choiceBias?: number;
};

/**
 * fired-депы на БИТЫ → id их дефов (beat:<id>).
 *
 * Обязательно: evaluateSlice пишет в state.fired ИМЕННО id дефа (с префиксом), а
 * evalGuard сравнивает по сырому значению {fired}. Без remap любая цепочка
 * порядка невыполнима в симуляции — и КАЖДАЯ политика ложно провалила бы финал.
 * Депы на юниты не трогаем: их дефы живут под собственными id.
 */
function remapBeatFired(guard: Guard, beatIds: Set<string>): Guard {
  if ('all' in guard) return { all: guard.all.map(g => remapBeatFired(g, beatIds)) };
  if ('any' in guard) return { any: guard.any.map(g => remapBeatFired(g, beatIds)) };
  if ('not' in guard) return { not: remapBeatFired(guard.not, beatIds) };
  if ('fired' in guard && beatIds.has(guard.fired)) return { fired: `${BEAT_DEF_PREFIX}${guard.fired}` };
  return guard;
}

/** Бит хребта → EventDef; исход развилки политики вшит как доп. setFlag. */
function beatToDef(beat: SpineBeat, chosenOutcome: SpineBeatOutcome | null, beatIds: Set<string>): EventDef {
  return {
    id: `${BEAT_DEF_PREFIX}${beat.id}`,
    kind: 'state_change',
    at: { locationId: beat.locationId, slot: beat.window },
    participants: beat.participants.filter(p => !p.startsWith('$')),
    guard: remapBeatFired(beat.guard, beatIds),
    effects: [
      ...beat.establishes.map(f => ({ setFlag: f } as const)),
      ...(chosenOutcome ? [{ setFlag: chosenOutcome.setsFlag } as const] : []),
    ],
    priority: 0,
  };
}

function buildPolicies(inputs: StoryQAInputs, names: string[]): PolicyImpl[] {
  const { brief, spine, schedule } = inputs;
  const liIds = brief.loveInterests.map(li => li.id);

  const firstOutcome = (beat: SpineBeat): SpineBeatOutcome | null => beat.outcomes?.[0] ?? null;

  /** Локация LI в слоте (null = за кадром / нет в расписании). */
  const liLocation = (liId: string, slot: number): string | null => schedule[liId]?.[slot] ?? null;

  /** Занятые локации слота (детерминированно отсортированы). */
  const occupiedLocations = (slot: number): string[] => {
    const set = new Set<string>();
    for (const liId of liIds) {
      const loc = liLocation(liId, slot);
      if (loc) set.add(loc);
    }
    return [...set].sort();
  };

  /** «Самый ранний созревший несыгранный бит»: слот внутри окна, бит не сработал. */
  const earliestMaturedBeat = (slot: number, firedBeatIds: Set<string>): SpineBeat | null => {
    const matured = spine.beats
      .filter(b => !firedBeatIds.has(b.id) && slot >= b.window.fromSlot && slot <= b.window.toSlot)
      .sort(
        (a, b) => a.window.fromSlot - b.window.fromSlot || a.window.toSlot - b.window.toSlot || (a.id < b.id ? -1 : 1),
      );
    return matured[0] ?? null;
  };

  const build = (name: string): PolicyImpl => {
    if (name === 'spine-only') {
      return {
        name,
        pickLocation: (slot, fired) => earliestMaturedBeat(slot, fired)?.locationId ?? null,
        pickOutcome: firstOutcome,
      };
    }
    if (name.startsWith('greedy-li:')) {
      const liId = name.slice('greedy-li:'.length);
      return { name, pickLocation: slot => liLocation(liId, slot), pickOutcome: firstOutcome };
    }
    // Прилежный игрок: ходит за своим LI и выбирает тепло — верхняя граница
    // продвижения по лестнице (проверка завершаемости арки).
    if (name.startsWith('warm-li:')) {
      const liId = name.slice('warm-li:'.length);
      return {
        name,
        pickLocation: slot => liLocation(liId, slot),
        pickOutcome: firstOutcome,
        choiceBias: CHOICE_PATH_DELTA_CAP,
      };
    }
    if (name === 'round-robin') {
      return {
        name,
        pickLocation: slot => (liIds.length > 0 ? liLocation(liIds[slot % liIds.length], slot) : null),
        pickOutcome: firstOutcome,
      };
    }
    if (name.startsWith('seeded-random:')) {
      const seed = Number(name.slice('seeded-random:'.length)) || 0;
      return {
        name,
        pickLocation: slot => {
          const occ = occupiedLocations(slot);
          if (occ.length === 0) return null;
          return occ[policyHash(name, slot, seed) % occ.length];
        },
        pickOutcome: beat => {
          const outcomes = beat.outcomes ?? [];
          if (outcomes.length === 0) return null;
          return outcomes[policyHash(beat.id, 0, seed) % outcomes.length];
        },
      };
    }
    // Неизвестное имя — политика «ждать всегда» (отчёт честно провалится).
    return { name, pickLocation: () => null, pickOutcome: firstOutcome };
  };

  return names
    .flatMap(n => {
      if (n === 'greedy-li:*') return liIds.map(id => `greedy-li:${id}`);
      if (n === 'warm-li:*') return liIds.map(id => `warm-li:${id}`);
      return [n];
    })
    .map(build);
}

/**
 * Прогон детерминированных политик игрока по evaluateSlice. Позиции
 * персонажей на каждом слоте сбрасываются из колонок расписания; политика
 * выбирает ОДНУ локацию героини — события в других локациях не срабатывают
 * (в этом смысл симуляции: контент должен быть достижим ходьбой).
 *
 * Утверждения живут в ОТЧЁТЕ (см. summarizePolicyReports), не бросаются.
 */
export function simulatePolicies(inputs: StoryQAInputs, policies: string[] = DEFAULT_POLICIES): PolicyReport[] {
  const { brief, calendar, schedule } = inputs;
  // Симулируем ТОТ ЖЕ граф, что соберёт компилятор: лестница отношений
  // (полы окон + rel-пороги) и цепочка порядка битов. Обе идемпотентны.
  // Без этого QA валидировал бы игру, которой нет: гейты есть в собранном
  // графе, но не в симуляции.
  const ladder = applyLadderGuards(inputs.eventUnits, inputs.spine, calendar, brief);
  const eventUnits = ladder.units;
  const spine = applyBeatChain(ladder.spine, calendar, new Set(brief.loveInterests.map(li => li.id)), eventUnits);
  const liIds = brief.loveInterests.map(li => li.id);
  const slotCount = calendar.slotCount;
  const reachable = computeReachableUnits(spine, calendar, eventUnits);
  // Валюта арки — ОДНА: детерминированный closing-гейн ступени, который
  // compileCalendarGame вешает на closing-ребро.
  //
  // rel-эффекты пула от LLM здесь отбрасываются намеренно: собранная игра их
  // никогда не применяла (closing нёс только met/unit/флаги/slot), а симулятор
  // применял — и showed отношения, которых в игре нет. Оставить оба канала
  // значило бы удвоить валюту: на реальной истории affection упирался в
  // потолок 1.0, и любой rel-порог становился бы бутафорией.
  const unitDefs: EventDef[] = eventUnits
    .filter(u => reachable.has(u.id))
    .map(u => {
      const liId = u.participants[0] ?? '';
      const gain = ladder.plan.closingGain.get(u.id) ?? 0;
      const effects = u.effects.filter(e => !('rel' in e));
      if (gain > 0 && liId) effects.push({ rel: { char: liId, var: 'affection', delta: gain, clamp: [-1, 1] } });
      return { ...u, effects };
    });
  const finale = spine.beats.find(b => b.kind === 'finale') ?? null;
  const beatIds = new Set(spine.beats.map(b => b.id));

  return buildPolicies({ ...inputs, spine }, policies).map(policy => {
    const defs: EventDef[] = [
      ...spine.beats.map(b => beatToDef(b, b.kind === 'branchPoint' ? policy.pickOutcome(b) : null, beatIds)),
      ...unitDefs,
    ];

    // Отношения стартуют с АРХЕТИПНЫХ значений — тех же, что дефолты stateSchema
    // собранной игры. Нули были слепым пятном: «тёплые» архетипы (forbidden 0.5,
    // mutual_pining 0.6) начинают игру заметно выше нуля, и QA, считавший с нуля,
    // не видел ни ранних тёплых веток, ни выполнимости rel-гейтов.
    const state: SliceState = createSliceState({
      relationships: Object.fromEntries(
        liIds.map(id => [id, { ...DEFAULT_RELATIONSHIP, affection: ladder.plan.startByLi.get(id) ?? 0 }]),
      ),
    });

    const deadSlots: number[] = [];
    const firedBeatIds = new Set<string>();
    const firedUnits: string[] = [];
    const firedBeats: string[] = [];
    /** Разговоров сыграно за прогон — метрика плотности контента (см. отчёт). */
    let actsPlayed = 0;

    // Слот проживается ФАЗАМИ. Раньше цикл делал один pickLocation на слот —
    // структурное зеркало отменённого тарифа «встреча = слот». Теперь слот
    // двигают только сюжет и якоря, а внутри слота помещается до PHASES_PER_SLOT
    // разговоров; сим обязан судить ту игру, которая есть, иначе он валидирует
    // несуществующую.
    for (let slot = 0; slot < slotCount; slot++) {
      // Позиции каждого слота — колонка расписания (перемещения слота не копятся).
      state.positions = Object.fromEntries(liIds.map(id => [id, schedule[id]?.[slot] ?? null]));

      let phase = 0;
      let visited = false;
      let firedHere = 0;

      while (phase < PHASES_PER_SLOT) {
        const loc = policy.pickLocation(slot, firedBeatIds);
        if (loc == null) break; // политика никуда не пошла — мёртвым не считаем.
        visited = true;

        const evaluation = evaluateSlice(defs, { z: slot, slot, phase }, state, loc);
        if (evaluation.fired.length === 0) break;
        firedHere += evaluation.fired.length;

        let dialoguesFired = 0;
        for (const def of evaluation.fired) {
          if (def.id.startsWith(BEAT_DEF_PREFIX)) {
            const beatId = def.id.slice(BEAT_DEF_PREFIX.length);
            firedBeatIds.add(beatId);
            firedBeats.push(beatId);
          } else {
            dialoguesFired++;
            actsPlayed++;
            firedUnits.push(def.id);
            // Канал выборов: симулятор не проигрывает граф диалога, поэтому
            // поведение игрока В сцене — одно число на встречу (см. choiceBias).
            const bias = policy.choiceBias ?? 0;
            const liId = def.participants[0] ?? '';
            if (bias !== 0 && liId) {
              const rel = state.relationships[liId] ?? { ...DEFAULT_RELATIONSHIP };
              rel.affection = Math.max(-1, Math.min(1, rel.affection + bias));
              state.relationships[liId] = rel;
            }
          }
        }
        // Фазу тратят только разговоры. Отыграли одни биты — повторять проход
        // бессмысленно: evaluateSlice их уже зафиксировал в state.fired.
        if (dialoguesFired === 0) break;
        phase += dialoguesFired;
      }

      // Мёртвый слот — тот, куда игрок пришёл и не нашёл НИЧЕГО.
      if (visited && firedHere === 0) deadSlots.push(slot);
    }

    // Первая концовка, чей guard выполним финальным состоянием; bracket-guard
    // оценивается bracketOfAffection по финальным отношениям с e.liId.
    const endingSatisfied =
      spine.endings.find(e =>
        evalGuard(
          e.guard,
          {
            x: e.liId ?? '',
            y: '',
            z: { z: slotCount, slot: slotCount },
            R: state.relationships[e.liId ?? ''] ?? DEFAULT_RELATIONSHIP,
            H: { flags: state.flags, fired: state.fired },
          },
          state,
        ),
      )?.id ?? null;

    // Регресс-страховка: движок гейтит биты по beat[<pred>] ≥ 1, значит в
    // честном прогоне бит не может опередить предшественника. Ловит поломку
    // remap-а или самой цепочки (тихо вернувшую хаотичный порядок).
    const orderIndex = new Map(firedBeats.map((id, i) => [id, i]));
    const orderViolations: string[] = [];
    for (const b of spine.beats) {
      const at = orderIndex.get(b.id);
      if (at == null) continue;
      for (const dep of guardFiredIds(b.guard)) {
        if (!beatIds.has(dep)) continue;
        const depAt = orderIndex.get(dep);
        if (depAt == null || depAt > at) orderViolations.push(`${b.id} до ${dep}`);
      }
    }

    return {
      policy: policy.name,
      reachedFinale: finale != null && firedBeatIds.has(finale.id),
      endingSatisfied,
      firedBeats,
      firedUnits,
      deadSlots,
      actsPlayed,
      relFinal: Object.fromEntries(liIds.map(id => [id, state.relationships[id]?.affection ?? 0])),
      slotCount,
      orderViolations,
    };
  });
}

/** Отчёты политик → issues: провал финала/концовки = error, мёртвые слоты = warning. */
export function summarizePolicyReports(reports: PolicyReport[]): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  for (const r of reports) {
    if (!r.reachedFinale) {
      issues.push({
        severity: 'error',
        scope: `sim/${r.policy}`,
        message: `политика не достигает финала за ${r.slotCount} слотов (сыграно битов: ${r.firedBeats.length})`,
      });
    }
    if (r.endingSatisfied == null) {
      issues.push({
        severity: 'error',
        scope: `sim/${r.policy}`,
        message: 'ни одна концовка не выполнима финальным состоянием прогона',
      });
    }
    if (r.deadSlots.length > r.slotCount / 3) {
      issues.push({
        severity: 'warning',
        scope: `sim/${r.policy}`,
        message: `мёртвых слотов ${r.deadSlots.length} из ${r.slotCount} (>1/3) — игрок часто приходит в пустоту`,
      });
    }
    if (r.orderViolations && r.orderViolations.length > 0) {
      issues.push({
        severity: 'error',
        scope: `sim/${r.policy}`,
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
