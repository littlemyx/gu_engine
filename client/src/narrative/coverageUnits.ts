import type { Brief, SegmentIssue } from './types';
import type { Calendar, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import { FILLER_RECOVERY_DELTA, ladderThreshold } from './calendarTypes';
import { assignBeatSlots } from './beatSchedule';
import { archetypeAffectionStart, effectiveStageCount } from './ladderGuards';
import { scheduleRuns } from './compileCalendarGame';

/**
 * Покрытие расписания взаимодействиями (симптом B репортнутого бага).
 *
 * Расписание ставит LI в локацию, но кнопка «Поговорить» рождается ТОЛЬКО из
 * EventUnit-а с прозой (compileCalendarGame). validateEventUnits проверяет лишь
 * обратное направление — «юнит там, где персонаж бывает», — поэтому слот, куда
 * пул не дотянулся, оставался немым: игрок сидел в кафе с Юки и не мог с ней
 * заговорить. Хуже: useUnitEncounters отключает фолбэк по расписанию, стоит
 * появиться хоть одному юниту у ЛЮБОГО персонажа.
 *
 * Здесь мы меряем покрытие в прямом направлении (расписание → юнит) и достраиваем
 * недостающие встречи детерминированными филлерами. Это же чинит и симптом A:
 * гейт головы линии (beatChain) вешается на самую раннюю встречу, а без филлера
 * её просто не существовало бы.
 */

/** Диапазон присутствия LI, не покрытый ни одной встречей. */
export type UncoveredRun = { liId: string; locId: string; fromSlot: number; toSlot: number };

const overlaps = (a: { fromSlot: number; toSlot: number }, b: { fromSlot: number; toSlot: number }): boolean =>
  a.fromSlot <= b.toSlot && b.fromSlot <= a.toSlot;

/**
 * Диапазоны расписания без диалогового юнита в той же локации.
 *
 * Слоты, где LI занят битом хребта, пропускаем: там играется сцена, а не
 * «поболтать» — немым такой слот не выглядит.
 */
export function computeUncoveredRuns(
  spine: SpinePlan,
  calendar: Calendar,
  schedule: CharacterSchedule,
  units: EventUnit[],
): UncoveredRun[] {
  const beatSlots = assignBeatSlots(spine, calendar);
  const pinned = new Set<string>();
  for (const b of spine.beats) {
    const s = beatSlots[b.id];
    if (s == null) continue;
    for (const p of b.participants) pinned.add(`${p}@${s}`);
  }

  const dialogueUnits = units.filter(u => u.kind === 'dialogue' && u.at.slot != null && u.at.locationId != null);
  const uncovered: UncoveredRun[] = [];

  for (const run of scheduleRuns(schedule, calendar.slotCount)) {
    const covered = dialogueUnits.some(
      u => u.participants[0] === run.liId && u.at.locationId === run.locId && overlaps(u.at.slot!, run),
    );
    if (covered) continue;
    // Диапазон целиком занят битами — «поговорить» там не требуется.
    let free = false;
    for (let s = run.fromSlot; s <= run.toSlot; s++) {
      if (!pinned.has(`${run.liId}@${s}`)) {
        free = true;
        break;
      }
    }
    if (free) uncovered.push({ liId: run.liId, locId: run.locId, fromSlot: run.fromSlot, toSlot: run.toSlot });
  }
  return uncovered;
}

/** Отчёт о немых диапазонах — попадает в story QA и сидирует перегенерацию пула. */
export function coverageIssues(
  spine: SpinePlan,
  calendar: Calendar,
  schedule: CharacterSchedule,
  units: EventUnit[],
): SegmentIssue[] {
  return computeUncoveredRuns(spine, calendar, schedule, units).map(run => ({
    severity: 'warning',
    scope: `coverage/${run.liId}`,
    message: `"${run.liId}" стоит в "${run.locId}" в слотах [${run.fromSlot}, ${run.toSlot}], но заговорить с ней там нечем — пул событий не покрывает этот диапазон`,
  }));
}

/** id филлера детерминирован: повторный прогон видит диапазон уже покрытым. */
export const fillerUnitId = (liId: string, locId: string, fromSlot: number): string =>
  `filler_${liId}_${locId}_${fromSlot}`;

/**
 * Достройка немых диапазонов встречами-«поболтать».
 *
 * guard пустой: филлер — это и есть точка входа в линию (гейт головы ссылается
 * на него), поэтому он не должен ничего требовать.
 *
 * Ступень 1 и маленький гейн — это канал ВОССТАНОВЛЕНИЯ. Ступени лестницы
 * гейтятся порогами близости, а сюжетные встречи одноразовы: игрок, ушедший в
 * минус, иначе запирался бы навсегда — линия LI мертва до конца истории, и это
 * не «строгий гейт», а тупик. Пустая болтовня даёт медленно догнать порог.
 * Фармить ею нельзя: гейт `affection < порог следующей ступени` закрывает
 * филлер, как только игрок дорос, — догоняющий канал, а не источник близости.
 */
export function synthesizeCoverageFillers(
  spine: SpinePlan,
  calendar: Calendar,
  schedule: CharacterSchedule,
  units: EventUnit[],
  brief: Brief,
): EventUnit[] {
  const liById = new Map(brief.loveInterests.map(li => [li.id, li]));
  const stageCount = effectiveStageCount(units, calendar);
  return computeUncoveredRuns(spine, calendar, schedule, units)
    .filter(run => liById.has(run.liId))
    .map(run => {
      const id = fillerUnitId(run.liId, run.locId, run.fromSlot);
      // Потолок догона — порог ступени 2: выше филлер не пускает, дальше
      // близость зарабатывается только настоящими сценами арки.
      const a0 = archetypeAffectionStart(brief, run.liId);
      const ceil = ladderThreshold(a0, 2, stageCount);
      return {
        id,
        kind: 'dialogue',
        at: { slot: { fromSlot: run.fromSlot, toSlot: run.toSlot }, locationId: run.locId },
        participants: [run.liId],
        // op '<=' , не '<': движок умеет только ≥/≤, а строгое сравнение
        // relConditions молча выбросил бы — гейта бы просто не стало.
        guard: { all: [{ rel: { var: 'affection', op: '<=', value: ceil } }] },
        effects: [{ rel: { char: run.liId, var: 'affection', delta: FILLER_RECOVERY_DELTA, clamp: [-1, 1] } }],
        scene: { kind: 'dialogue', anchorId: id, liId: run.liId },
        priority: 30,
        goal: `Поболтать с ${liById.get(run.liId)!.name} — ни к чему не обязывающий разговор`,
        arcStage: 1,
        source: 'filler',
      };
    });
}
