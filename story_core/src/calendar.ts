/**
 * Календарная арифметика: время как первоклассная дискретная ось.
 *
 * Слот = (день, часть дня), кодируется единым integer
 * `slot = day * dayparts.length + daypartIndex`.
 *
 * Двухслойная модель времени. БОЛЬШАЯ стрелка (slot) движется только сюжетом:
 * битом хребта либо якорным переходом («пойти спать»). Разговоры её не крутят —
 * плейтест показал, во что это выливается: беседа начиналась вечером, а после
 * прощания наступало утро, и ночь исчезала как побочный эффект.
 *
 * МАЛАЯ стрелка (phase) — часы САМОГО СЛОТА, а не бюджет действий игрока.
 * Разговор расходует фазу; к поздней фазе персонаж «менее восприимчив» —
 * глубокие ветки закрываются, остаются сюжетные. Дефицит создаёт мир (люди
 * заняты), а не счётчик очков: игрок не видит числа, он видит, что человек
 * уже не тот.
 *
 * Типы структурные: и полный Calendar генератора, и урезанный календарь
 * бандла подходят по форме — арифметике нужны только части дня и границы.
 */

import type { PhaseWindow, SlotWindow } from './state';

/** Минимум для арифметики дней и частей дня. */
export type DaypartsLike = { dayparts: string[] };

/** + границы актов (день начала каждого акта; actBoundaries[0] === 0). */
export type ActsLike = DaypartsLike & { actBoundaries: number[]; days: number };

export const DEFAULT_DAYPARTS = ['утро', 'день', 'вечер'];

export const slotOf = (day: number, daypartIndex: number, daypartsPerDay: number): number =>
  day * daypartsPerDay + daypartIndex;

export const dayOfSlot = (slot: number, cal: DaypartsLike): number => Math.floor(slot / cal.dayparts.length);

export const daypartOfSlot = (slot: number, cal: DaypartsLike): string => cal.dayparts[slot % cal.dayparts.length] ?? '';

/** «день 3 · вечер» (день 1-based для человека). */
export const slotLabel = (slot: number, cal: DaypartsLike): string =>
  `день ${dayOfSlot(slot, cal) + 1} · ${daypartOfSlot(slot, cal)}`;

/** Акт слота по границам дней; акты 1-based. */
export function actOfSlot(slot: number, cal: ActsLike): number {
  const day = dayOfSlot(slot, cal);
  let act = 1;
  for (let i = 1; i < cal.actBoundaries.length; i++) {
    if (day >= cal.actBoundaries[i]) act = i + 1;
  }
  return act;
}

/** Окно слотов акта [fromSlot, toSlot] включительно. */
export function actSlotWindow(act: number, cal: ActsLike): SlotWindow {
  const perDay = cal.dayparts.length;
  const fromDay = cal.actBoundaries[act - 1] ?? 0;
  const toDay = act < cal.actBoundaries.length ? cal.actBoundaries[act] - 1 : cal.days - 1;
  return { fromSlot: fromDay * perDay, toSlot: toDay * perDay + perDay - 1 };
}

/** Расписание: персонаж → локация в каждом слоте (null = за кадром). */
export type ScheduleLike = Record<string, Array<string | null>>;

/** Диапазон подряд идущих слотов персонажа в одной локации. */
export type ScheduleRun = { liId: string; locId: string; fromSlot: number; toSlot: number };

/**
 * Run-length кодирование расписания: смежные слоты в одной локации → диапазон.
 *
 * «Дежурство» персонажа — естественная единица планирования контента: сцену
 * имеет смысл вешать на диапазон присутствия, а не на отдельный слот.
 */
export function scheduleRuns(schedule: ScheduleLike, slotCount: number): ScheduleRun[] {
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

/** Фаз в одной части дня: «первая половина / вторая половина». */
export const PHASES_PER_SLOT = 2;

/** Когда в пределах части дня уместен разговор — семантика от смысла сцены. */
export type UnitTiming = 'early' | 'late' | 'any';

/**
 * Окно фаз по семантике контента.
 *
 * Восприимчивость — свойство СЦЕНЫ, а не позиции в слоте: «подбодрить
 * вымотанную к концу смены» обязано открываться именно поздно, и жёсткое
 * «глубокое — только на свежую голову» такую арку бы запретило. Поэтому окно
 * выбирает генерация (поле timing у юнита), а лестница даёт лишь дефолт.
 */
export function phaseWindowForTiming(timing: UnitTiming): PhaseWindow {
  const last = Math.max(0, PHASES_PER_SLOT - 1);
  if (timing === 'early') return { fromPhase: 0, toPhase: 0 };
  if (timing === 'late') return { fromPhase: last, toPhase: last };
  return { fromPhase: 0, toPhase: last };
}

/**
 * ДЕФОЛТ окна фаз для ступени s — когда генерация timing не указала.
 *
 * Ступень 1 и филлеры («поболтать») уместны в любой момент части дня; глубокий
 * разговор ступени ≥2 по умолчанию требует свежей фазы. Это именно дефолт:
 * собственный timing юнита его не перетирает (см. applyLadderGuards).
 */
export function phaseWindowForStage(stage: number): PhaseWindow {
  return phaseWindowForTiming(stage >= 2 ? 'early' : 'any');
}
