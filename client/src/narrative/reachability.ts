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
 */
export function computeReachableUnits(spine: SpinePlan, calendar: Calendar, units: EventUnit[]): Set<string> {
  const unitById = new Map(units.map(u => [u.id, u]));
  const beatSlots = assignBeatSlots(spine, calendar);

  // Базовые установители: биты хребта в свой назначенный слот.
  const beatEstablish = new Map<string, number>();
  const noteFlag = (map: Map<string, number>, flag: string, slot: number) => {
    const prev = map.get(flag);
    if (prev == null || slot < prev) map.set(flag, slot);
  };
  for (const beat of spine.beats) {
    const slot = beatSlots[beat.id];
    if (slot == null) continue;
    for (const f of beat.establishes) noteFlag(beatEstablish, f, slot);
    for (const o of beat.outcomes ?? []) noteFlag(beatEstablish, o.setsFlag, slot);
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
