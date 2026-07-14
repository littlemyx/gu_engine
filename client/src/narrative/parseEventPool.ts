import type { Brief, LoveInterestCard, SegmentIssue } from './types';
import type { Calendar, CastPlan, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import { guardFromRequires } from './calendarTypes';
import type { Effect, Guard } from './events';
import { guardFlags } from './validateSpine';

/**
 * Стадия eventPool (B2, фаза 4 docs/plans/calendar-branching.md):
 * LLM выдаёт шеллы событий одного персонажа (guard+goal+effects, БЕЗ прозы),
 * клиент превращает их в EventUnit-ы модели событий и валидирует против
 * расписания/хребта/календаря.
 */

/** Границы rel-дельты юнита (клампится парсером, проверяется валидатором). */
export const REL_DELTA_BOUND = 0.3;

/** Целевое число юнитов на стадию арки (контракт targets стадии B2). */
export const EVENT_POOL_UNITS_PER_STAGE = 2;

const MIN_UNITS_PER_CHAR = 4;
const MAX_UNITS_PER_CHAR = 8;

const REL_VARS = new Set(['affection', 'trust', 'tension']);

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : []);

/** id fired-зависимостей guard-а (для валидации и reachability). */
export function guardFiredIds(guard: Guard): string[] {
  if ('all' in guard) return guard.all.flatMap(guardFiredIds);
  if ('any' in guard) return guard.any.flatMap(guardFiredIds);
  if ('not' in guard) return guardFiredIds(guard.not);
  if ('fired' in guard) return [guard.fired];
  return [];
}

/**
 * Ответ LLM → EventUnit[]. id префиксуется evt_<liId>_; цепочка стадий
 * достраивается АВТОМАТИЧЕСКИ: каждый юнит стадии N>1 получает guard
 * {fired: <последний юнит стадии N-1>} — у LLM её не спрашиваем.
 */
export function parseEventPool(rawText: string, liId: string): EventUnit[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`eventPool JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (!Array.isArray(obj.units)) throw new Error('eventPool missing required array: units');

  type RawShell = {
    id: string;
    arcStage: number;
    goal: string;
    locationId: string;
    window: { fromSlot: number; toSlot: number };
    requires: string[];
    establishes: string[];
    relEffects: { var: string; delta: number }[];
  };

  const shells: RawShell[] = (obj.units as unknown[]).map((u, i) => {
    const unit = u as Record<string, unknown>;
    if (!unit.id) throw new Error(`units[${i}] missing required field: id`);
    if (!unit.locationId) throw new Error(`units[${i}] missing required field: locationId`);
    const w = (unit.window ?? {}) as Record<string, unknown>;
    const fromSlot = Number(w.fromSlot);
    const toSlot = Number(w.toSlot);
    if (!Number.isFinite(fromSlot) || !Number.isFinite(toSlot)) {
      throw new Error(`units[${i}] window.fromSlot/toSlot must be numbers`);
    }
    const stage = Number(unit.arcStage);
    return {
      id: String(unit.id),
      arcStage: Number.isFinite(stage) ? Math.trunc(stage) : 1,
      goal: String(unit.goal ?? ''),
      locationId: String(unit.locationId),
      window: { fromSlot: Math.trunc(fromSlot), toSlot: Math.trunc(toSlot) },
      requires: asStringArray(unit.requires),
      establishes: asStringArray(unit.establishes),
      relEffects: Array.isArray(unit.relEffects)
        ? (unit.relEffects as unknown[]).map(re => {
            const r = re as Record<string, unknown>;
            return { var: String(r.var ?? 'affection'), delta: Number(r.delta ?? 0) || 0 };
          })
        : [],
    };
  });

  // Последний юнит каждой стадии — хвост fired-цепочки для стадии N+1.
  const prefixed = (rawId: string) => (rawId.startsWith(`evt_${liId}_`) ? rawId : `evt_${liId}_${rawId}`);
  const lastOfStage = new Map<number, string>();
  for (const s of shells) lastOfStage.set(s.arcStage, prefixed(s.id));

  return shells.map((s, index) => {
    const guard = guardFromRequires(s.requires);
    const chainTail = s.arcStage > 1 ? lastOfStage.get(s.arcStage - 1) : undefined;
    if (chainTail) (guard as { all: Guard[] }).all.push({ fired: chainTail });

    const effects: Effect[] = s.relEffects.map(re => ({
      rel: {
        char: liId,
        var: REL_VARS.has(re.var) ? re.var : 'affection',
        delta: Math.max(-REL_DELTA_BOUND, Math.min(REL_DELTA_BOUND, re.delta)),
        clamp: [-1, 1],
      },
    }));
    for (const f of s.establishes) effects.push({ setFlag: f });

    const id = prefixed(s.id);
    return {
      id,
      kind: 'dialogue',
      at: { slot: s.window, locationId: s.locationId },
      participants: [liId],
      guard,
      effects,
      scene: { kind: 'dialogue', anchorId: id, liId },
      priority: 20 + index,
      goal: s.goal,
      arcStage: s.arcStage,
      source: 'agenda',
    };
  });
}

/** Флаги, устанавливаемые юнитом (setFlag-эффекты). */
export function unitEstablishes(unit: EventUnit): string[] {
  return unit.effects.flatMap(e => ('setFlag' in e ? [e.setFlag] : []));
}

/**
 * Валидация пула событий против брифа/календаря/хребта/расписания:
 *   - окна в календаре (error);
 *   - locationId совпадает с расписанием LI хотя бы в одном слоте окна
 *     (error — событие там, где персонажа не бывает);
 *   - requires-флаги устанавливаются хребтом или юнитами (error);
 *   - rel-дельты в границах ±REL_DELTA_BOUND (error);
 *   - 4-8 юнитов на персонажа (warning).
 */
export function validateEventUnits(
  units: EventUnit[],
  brief: Brief,
  calendar: Calendar,
  spine: SpinePlan,
  schedule: CharacterSchedule,
): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const lastSlot = calendar.slotCount - 1;

  // Известные флаги: establishes хребта (+ исходы развилок) и юнитов.
  const knownFlags = new Set<string>();
  for (const b of spine.beats) {
    for (const f of b.establishes) knownFlags.add(f);
    for (const o of b.outcomes ?? []) knownFlags.add(o.setsFlag);
  }
  for (const u of units) for (const f of unitEstablishes(u)) knownFlags.add(f);

  const byChar = new Map<string, EventUnit[]>();

  for (const unit of units) {
    const scope = `units/${unit.id}`;
    const liId = unit.participants[0] ?? '';
    const list = byChar.get(liId) ?? [];
    list.push(unit);
    byChar.set(liId, list);

    const win = unit.at.slot;
    if (!win) {
      issues.push({ severity: 'error', scope, message: `юнит "${unit.id}" без слот-окна at.slot` });
      continue;
    }
    if (win.fromSlot > win.toSlot || win.fromSlot < 0 || win.toSlot > lastSlot) {
      issues.push({
        severity: 'error',
        scope,
        message: `окно юнита "${unit.id}" [${win.fromSlot}, ${win.toSlot}] выходит за календарь [0, ${lastSlot}]`,
      });
      continue;
    }

    // Событие — там, где персонаж бывает по расписанию.
    const slots = schedule[liId] ?? [];
    let onLocation = false;
    for (let s = win.fromSlot; s <= win.toSlot; s++) {
      if (slots[s] === unit.at.locationId) {
        onLocation = true;
        break;
      }
    }
    if (!onLocation) {
      issues.push({
        severity: 'error',
        scope,
        message: `юнит "${unit.id}" в локации "${unit.at.locationId}", где "${liId}" не бывает ни в одном слоте окна [${win.fromSlot}, ${win.toSlot}]`,
      });
    }

    // requires-флаги известны (fired-цепочку добавил парсер — не проверяем здесь).
    for (const f of guardFlags(unit.guard)) {
      if (!knownFlags.has(f)) {
        issues.push({
          severity: 'error',
          scope,
          message: `юнит "${unit.id}" требует флаг "${f}", который не устанавливает ни хребет, ни другие юниты`,
        });
      }
    }

    // rel-дельты в границах.
    for (const e of unit.effects) {
      if ('rel' in e && Math.abs(e.rel.delta) > REL_DELTA_BOUND) {
        issues.push({
          severity: 'error',
          scope,
          message: `rel-дельта ${e.rel.var} ${e.rel.delta} юнита "${unit.id}" вне границ ±${REL_DELTA_BOUND}`,
        });
      }
    }
  }

  for (const [liId, list] of byChar) {
    if (list.length < MIN_UNITS_PER_CHAR || list.length > MAX_UNITS_PER_CHAR) {
      issues.push({
        severity: 'warning',
        scope: `coverage/${liId}`,
        message: `у "${liId}" ${list.length} юнитов — целевой диапазон ${MIN_UNITS_PER_CHAR}-${MAX_UNITS_PER_CHAR}`,
      });
    }
  }

  return issues;
}

/**
 * Payload стадии eventPool: O(1)-контекст одного персонажа — карточка LI +
 * агенда, выжимка его расписания (non-null слоты), релевантные биты хребта
 * и размеры календаря.
 */
export function buildEventPoolRequestPayload(
  brief: Brief,
  li: LoveInterestCard,
  castPlan: CastPlan,
  schedule: CharacterSchedule,
  spine: SpinePlan,
  calendar: Calendar,
): {
  brief: Brief;
  liCard: LoveInterestCard;
  agenda: CastPlan['members'][number]['agenda'] | Record<string, never>;
  scheduleExcerpt: { slot: number; locationId: string }[];
  spineBeats: { id: string; summary: string; window: { fromSlot: number; toSlot: number } }[];
  calendar: { slotCount: number; dayparts: string[]; actBoundaries: number[] };
  targets: { unitsPerStage: number };
} {
  const agenda = castPlan.members.find(m => m.id === li.id)?.agenda ?? {};
  const scheduleExcerpt = (schedule[li.id] ?? []).flatMap((locationId, slot) =>
    locationId ? [{ slot, locationId }] : [],
  );
  const spineBeats = spine.beats
    .filter(b => b.participants.includes(li.id))
    .map(b => ({ id: b.id, summary: b.summary, window: b.window }));
  return {
    brief,
    liCard: li,
    agenda,
    scheduleExcerpt,
    spineBeats,
    calendar: {
      slotCount: calendar.slotCount,
      dayparts: calendar.dayparts,
      actBoundaries: calendar.actBoundaries,
    },
    targets: { unitsPerStage: EVENT_POOL_UNITS_PER_STAGE },
  };
}
