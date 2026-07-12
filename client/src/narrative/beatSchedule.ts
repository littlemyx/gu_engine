import type { Brief } from './types';
import type { Calendar, CastPlan, CharacterSchedule, SpinePlan } from './calendarTypes';
import { daypartOfSlot } from './calendarTypes';

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

/**
 * Назначение обязательных битов на слоты: жадный по дедлайну (toSlot) —
 * оптимален для интервального матчинга единичных задач, детерминирован.
 * Биты, которым не хватило слота, в результат не попадают (валидатор хребта
 * репортит это как error раньше).
 */
export function assignBeatSlots(spine: SpinePlan, calendar: Calendar): Record<string, number> {
  const ordered = [...spine.beats].sort(
    (a, b) => a.window.toSlot - b.window.toSlot || a.window.fromSlot - b.window.fromSlot || (a.id < b.id ? -1 : 1),
  );
  const taken = new Set<number>();
  const assigned: Record<string, number> = {};
  const lastSlot = calendar.slotCount - 1;
  for (const beat of ordered) {
    for (let s = Math.max(0, beat.window.fromSlot); s <= Math.min(lastSlot, beat.window.toSlot); s++) {
      if (!taken.has(s)) {
        taken.add(s);
        assigned[beat.id] = s;
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
