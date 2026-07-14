import type { Calendar, EventUnit, SpinePlan } from './calendarTypes';
import { assignBeatSlots } from './beatSchedule';
import { guardFlags } from './validateSpine';
import { guardFiredIds, unitEstablishes } from './parseEventPool';

/**
 * Reachability-pruning пула событий (B3, без LLM).
 *
 * Абстракция: флаг «достижим к слоту t», если самый ранний установитель
 * (бит хребта в назначенный слот или достижимый юнит в window.fromSlot)
 * успевает не позже t. Юнит достижим, если каждый requires-флаг успевает
 * к window.toSlot И каждая fired-зависимость сама достижима и стартует
 * не позже window.toSlot. Итерация до фикспойнта — юниты цепляются
 * друг за друга через establishes и fired.
 *
 * Недостижимым юнитам проза не генерируется — pruning заменяет
 * play-time-ленивость при полной прегенерации.
 *
 * Ветки (фаза 5): флаги исходов развилок входят в earliestEstablish с
 * window.fromSlot развилки — оптимистичная union-семантика («юнит достижим,
 * если ХОТЬ КАКАЯ-ТО ветка ставит его флаг») для генерации прозы. Для
 * превью конкретного листа — computeReachableUnitsFor с assignment:
 * флаги НЕвыбранных исходов исключаются.
 */
export function computeReachableUnits(spine: SpinePlan, calendar: Calendar, units: EventUnit[]): Set<string> {
  return computeReachable(spine, calendar, units, null);
}

/**
 * Per-leaf вариант для селектора веток монтажки: assignment =
 * branchPointId → выбранный outcomeId. Флаги исходов, не выбранных для
 * своей развилки, недоступны никогда; развилки вне assignment дают
 * union по всем своим исходам («—» = все ветки).
 */
export function computeReachableUnitsFor(
  spine: SpinePlan,
  calendar: Calendar,
  units: EventUnit[],
  assignment: Record<string, string>,
): Set<string> {
  return computeReachable(spine, calendar, units, assignment);
}

function computeReachable(
  spine: SpinePlan,
  calendar: Calendar,
  units: EventUnit[],
  assignment: Record<string, string> | null,
): Set<string> {
  const unitById = new Map(units.map(u => [u.id, u]));
  const beatSlots = assignBeatSlots(spine, calendar);

  // Базовые установители: биты хребта в свой назначенный слот; флаги
  // исходов — с начала окна развилки (оптимистично: точный слот выбора
  // зависит от прохождения, fromSlot — самый ранний возможный).
  const beatEstablish = new Map<string, number>();
  const noteFlag = (map: Map<string, number>, flag: string, slot: number) => {
    const prev = map.get(flag);
    if (prev == null || slot < prev) map.set(flag, slot);
  };
  for (const beat of spine.beats) {
    const slot = beatSlots[beat.id];
    if (slot != null) {
      for (const f of beat.establishes) noteFlag(beatEstablish, f, slot);
    }
    const chosen = assignment?.[beat.id];
    for (const o of beat.outcomes ?? []) {
      if (chosen != null && o.id !== chosen) continue;
      noteFlag(beatEstablish, o.setsFlag, Math.max(0, beat.window.fromSlot));
    }
  }

  const reachable = new Set<string>();

  // Фикспойнт: добавление юнита может открыть флаги/fired для следующих.
  let changed = true;
  while (changed) {
    changed = false;

    // earliestEstablish с учётом УЖЕ достижимых юнитов.
    const earliest = new Map<string, number>(beatEstablish);
    for (const id of reachable) {
      const u = unitById.get(id)!;
      const from = u.at.slot?.fromSlot ?? 0;
      for (const f of unitEstablishes(u)) noteFlag(earliest, f, from);
    }

    for (const unit of units) {
      if (reachable.has(unit.id)) continue;
      const toSlot = unit.at.slot?.toSlot ?? calendar.slotCount - 1;

      const flagsOk = guardFlags(unit.guard).every(f => {
        const est = earliest.get(f);
        return est != null && est <= toSlot;
      });
      if (!flagsOk) continue;

      const firedOk = guardFiredIds(unit.guard).every(depId => {
        if (!reachable.has(depId)) return false;
        const dep = unitById.get(depId);
        return dep != null && (dep.at.slot?.fromSlot ?? 0) <= toSlot;
      });
      if (!firedOk) continue;

      reachable.add(unit.id);
      changed = true;
    }
  }

  return reachable;
}
