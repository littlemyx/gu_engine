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
import { slotLabel } from './calendarTypes';
import type { EventDef, Guard, SliceState } from './events';
import { DEFAULT_RELATIONSHIP, createSliceState, evalGuard, evaluateSlice } from './events';
import { enumerateLeafAssignments, guardFlags, playableBeatsForLeaf, validateSpine } from './validateSpine';
import { validateCalendar } from './validateCalendar';
import { validateSchedule } from './buildSchedule';
import { unitEstablishes, validateEventUnits } from './parseEventPool';
import { computeReachableUnits, computeReachableUnitsFor } from './reachability';
import { assignBeatSlots } from './beatSchedule';
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
  issues.push(...prefixed('spine/', validateSpine(spine, calendar, brief, worldModel)));
  issues.push(...prefixed('calendar/', validateCalendar(calendar, brief, worldModel, tagMap, castPlan)));
  issues.push(...prefixed('schedule/', validateSchedule(schedule, spine, calendar, brief)));
  issues.push(...prefixed('units/', validateEventUnits(eventUnits, brief, calendar, spine, schedule)));

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

export type PolicyReport = {
  policy: string;
  reachedFinale: boolean;
  /** id первой выполнимой концовки (evalGuard по финальному состоянию), иначе null. */
  endingSatisfied: string | null;
  firedBeats: string[];
  firedUnits: string[];
  /** Слоты, где политика посетила локацию, но ничего не сработало. */
  deadSlots: number[];
  /** affection героини по LI на конец прогона. */
  relFinal: Record<string, number>;
  slotCount: number;
};

/**
 * Дефолтные политики; 'greedy-li:*' разворачивается в одну политику на
 * каждого LI брифа внутри simulatePolicies.
 */
export const DEFAULT_POLICIES = ['spine-only', 'greedy-li:*', 'round-robin', 'seeded-random:1', 'seeded-random:2'];

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
};

/** Бит хребта → EventDef; исход развилки политики вшит как доп. setFlag. */
function beatToDef(beat: SpineBeat, chosenOutcome: SpineBeatOutcome | null): EventDef {
  return {
    id: `${BEAT_DEF_PREFIX}${beat.id}`,
    kind: 'state_change',
    at: { locationId: beat.locationId, slot: beat.window },
    participants: beat.participants.filter(p => !p.startsWith('$')),
    guard: beat.guard,
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

  return names.flatMap(n => (n === 'greedy-li:*' ? liIds.map(id => `greedy-li:${id}`) : [n])).map(build);
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
  const { brief, calendar, spine, schedule, eventUnits } = inputs;
  const liIds = brief.loveInterests.map(li => li.id);
  const slotCount = calendar.slotCount;
  const reachable = computeReachableUnits(spine, calendar, eventUnits);
  const unitDefs: EventDef[] = eventUnits.filter(u => reachable.has(u.id));
  const finale = spine.beats.find(b => b.kind === 'finale') ?? null;

  return buildPolicies(inputs, policies).map(policy => {
    const defs: EventDef[] = [
      ...spine.beats.map(b => beatToDef(b, b.kind === 'branchPoint' ? policy.pickOutcome(b) : null)),
      ...unitDefs,
    ];

    const state: SliceState = createSliceState({
      relationships: Object.fromEntries(liIds.map(id => [id, { ...DEFAULT_RELATIONSHIP }])),
    });

    const deadSlots: number[] = [];
    const firedBeatIds = new Set<string>();
    const firedUnits: string[] = [];
    const firedBeats: string[] = [];

    for (let slot = 0; slot < slotCount; slot++) {
      // Позиции каждого слота — колонка расписания (перемещения слота не копятся).
      state.positions = Object.fromEntries(liIds.map(id => [id, schedule[id]?.[slot] ?? null]));

      const loc = policy.pickLocation(slot, firedBeatIds);
      if (loc == null) continue; // «Подождать» — мёртвым слотом не считается.

      const evaluation = evaluateSlice(defs, { z: slot, slot }, state, loc);
      if (evaluation.fired.length === 0) {
        deadSlots.push(slot);
        continue;
      }
      for (const def of evaluation.fired) {
        if (def.id.startsWith(BEAT_DEF_PREFIX)) {
          const beatId = def.id.slice(BEAT_DEF_PREFIX.length);
          firedBeatIds.add(beatId);
          firedBeats.push(beatId);
        } else {
          firedUnits.push(def.id);
        }
      }
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

    return {
      policy: policy.name,
      reachedFinale: finale != null && firedBeatIds.has(finale.id),
      endingSatisfied,
      firedBeats,
      firedUnits,
      deadSlots,
      relFinal: Object.fromEntries(liIds.map(id => [id, state.relationships[id]?.affection ?? 0])),
      slotCount,
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
      const { played } = playableBeatsForLeaf(spine, calendar, leaf.assignment);
      const beats = [...played]
        .map(id => beatById.get(id)!)
        .sort((a, b) => slotOfBeat(a) - slotOfBeat(b) || (a.id < b.id ? -1 : 1));
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
        endings: spine.endings.map(e => ({
          id: e.id,
          kind: e.kind,
          summary: `${e.liId ? `LI: ${e.liId}; ` : ''}требует: [${guardFlags(e.guard).join(', ')}]`,
        })),
        briefTone,
      };
    });
}
