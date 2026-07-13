import type { Brief } from './types';
import type { Calendar, CastPlan, CharacterSchedule, SpineBeat, SpinePlan } from './calendarTypes';
import { daypartOfSlot } from './calendarTypes';
import type { Guard } from './events';

/**
 * Детерминированная раскладка календарной модели: назначение битов хребта
 * на конкретные слоты и построение расписания персонажей.
 *
 * Никаких LLM-вызовов: раскладка пересчитывается на лету из spine + calendar
 * (+ агенды), поэтому дёшево перепроверяется валидаторами и переигрывается.
 *
 * Фаза 1: buildScheduleStub — упрощённое расписание (пины битов + равномерное
 * распределение по локациям тегов). Полный солвер с weekly-паттернами и
 * инвариантом «каждый слот — ≥2 осмысленные локации» приходит в фазе 4.
 */

/** Плоские флаги guard-а (локально — во избежание цикла с validateSpine). */
function flagsOfGuard(g: Guard): string[] {
  if ('all' in g) return g.all.flatMap(flagsOfGuard);
  if ('any' in g) return g.any.flatMap(flagsOfGuard);
  if ('not' in g) return flagsOfGuard(g.not);
  if ('flag' in g) return [g.flag];
  return [];
}

/** setsFlag → {развилка, исход}: какой исход какой развилки ставит флаг. */
function outcomeFlagIndex(spine: SpinePlan): Map<string, { bp: string; outcome: string }> {
  const idx = new Map<string, { bp: string; outcome: string }>();
  for (const b of spine.beats) {
    if (b.kind !== 'branchPoint') continue;
    for (const o of b.outcomes ?? []) idx.set(o.setsFlag, { bp: b.id, outcome: o.id });
  }
  return idx;
}

/**
 * Взаимоисключающие биты: оба требуют РАЗНЫХ исходов ОДНОЙ развилки, значит
 * никогда не играются на одном листе — могут делить слот (истинные ветки не
 * множат таймлайн). Биты из разных развилок или общие — co-play, им нужны
 * разные слоты.
 */
function beatsExclusive(a: SpineBeat, b: SpineBeat, idx: Map<string, { bp: string; outcome: string }>): boolean {
  const selA = new Map<string, string>();
  for (const f of flagsOfGuard(a.guard)) {
    const sel = idx.get(f);
    if (sel) selA.set(sel.bp, sel.outcome);
  }
  for (const f of flagsOfGuard(b.guard)) {
    const sel = idx.get(f);
    if (sel && selA.has(sel.bp) && selA.get(sel.bp) !== sel.outcome) return true;
  }
  return false;
}

/**
 * Назначение битов на слоты: жадный по дедлайну (toSlot), branch-aware — слот
 * делят только взаимоисключающие биты (разные исходы одной развилки, никогда не
 * на одном листе). Детерминирован. Окна берутся как есть: расширение до окна
 * акта делает normalizeSpineWindows ДО сохранения хребта, так что здесь окна уже
 * проигрываемые. Биты без слота (реальная коллизия co-play) в результат не
 * попадают — валидатор хребта репортит это как error.
 *
 * Без развилок beatsExclusive всегда false → каждому биту нужен свой слот, что
 * идентично прежнему жадному матчингу единичных задач.
 */
export function assignBeatSlots(spine: SpinePlan, calendar: Calendar): Record<string, number> {
  const idx = outcomeFlagIndex(spine);
  const ordered = [...spine.beats].sort(
    (a, b) => a.window.toSlot - b.window.toSlot || a.window.fromSlot - b.window.fromSlot || (a.id < b.id ? -1 : 1),
  );
  const slotOccupants = new Map<number, SpineBeat[]>();
  const assigned: Record<string, number> = {};
  const lastSlot = calendar.slotCount - 1;
  for (const b of ordered) {
    for (let s = Math.max(0, b.window.fromSlot); s <= Math.min(lastSlot, b.window.toSlot); s++) {
      const occ = slotOccupants.get(s) ?? [];
      if (occ.every(o => beatsExclusive(b, o, idx))) {
        assigned[b.id] = s;
        slotOccupants.set(s, [...occ, b]);
        break;
      }
    }
  }
  return assigned;
}

/**
 * Стаб-расписание фазы 1.
 *
 * Приоритет размещения персонажа в слоте:
 *   1. Пин бита: участник назначенного на слот бита стоит в локации бита.
 *   2. Weekly-паттерн агенды: самый тяжёлый тег части дня → первая локация тега.
 *   3. null (за кадром) — солвер фазы 4 добьёт покрытие.
 *
 * Плейсхолдеры ролей ("$closestLI") в participants стаб пропускает — их
 * резолвит компилятор/солвер по состоянию, а не расписание.
 */
export function buildScheduleStub(
  brief: Brief,
  spine: SpinePlan,
  calendar: Calendar,
  castPlan: CastPlan | null,
  tagMap: Record<string, string[]> | null,
): CharacterSchedule {
  const beatSlots = assignBeatSlots(spine, calendar);
  const schedule: CharacterSchedule = {};
  const memberById = new Map((castPlan?.members ?? []).map(m => [m.id, m]));

  for (const li of brief.loveInterests) {
    const slots: (string | null)[] = new Array<string | null>(calendar.slotCount).fill(null);

    // 2. Weekly-паттерн: часть дня → тег с максимальным весом → локация.
    const agenda = memberById.get(li.id)?.agenda;
    if (agenda && tagMap) {
      for (let s = 0; s < calendar.slotCount; s++) {
        const daypart = daypartOfSlot(s, calendar);
        const entries = agenda.weeklyPattern[daypart] ?? [];
        const best = [...entries].sort((a, b) => b.weight - a.weight)[0];
        const loc = best ? (tagMap[best.tag] ?? [])[0] : undefined;
        if (loc) slots[s] = loc;
      }
    }

    // 1. Пины битов поверх паттерна.
    for (const beat of spine.beats) {
      if (!beat.participants.includes(li.id)) continue;
      const s = beatSlots[beat.id];
      if (s != null) slots[s] = beat.locationId;
    }

    schedule[li.id] = slots;
  }

  return schedule;
}
