import type { Brief, LoveInterestCard, SegmentIssue } from './types';
import type { Calendar, CastPlan, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import { arcStageCount, guardFromRequires, phaseWindowForTiming, requiredArcStages } from './calendarTypes';
import type { UnitTiming } from './calendarTypes';
import type { Effect, Guard } from './events';
import { guardFiredIds } from './events';
import { guardFlags } from './validateSpine';
import { applyLadderGuards } from './ladderGuards';

// guardFiredIds переехал к Guard (events.ts) — здесь ре-экспорт для прежних
// импортёров; beatChain берёт его из events напрямую (иначе цикл через
// validateSpine).
export { guardFiredIds };

/**
 * Стадия eventPool (B2, фаза 4 docs/plans/calendar-branching.md):
 * LLM выдаёт шеллы событий одного персонажа (guard+goal+effects, БЕЗ прозы),
 * клиент превращает их в EventUnit-ы модели событий и валидирует против
 * расписания/хребта/календаря.
 */

/** Границы rel-дельты юнита (клампится парсером, проверяется валидатором). */
export const REL_DELTA_BOUND = 0.3;

const isUnitTiming = (v: unknown): v is UnitTiming => v === 'early' || v === 'late' || v === 'any';

/** Целевое число юнитов на стадию арки (контракт targets стадии B2). */
export const EVENT_POOL_UNITS_PER_STAGE = 2;

/**
 * Границы размера пула — от высоты лестницы: на N ступеней нужно минимум по
 * юниту, иначе ступень пропущена. Легаси N=3 даёт ровно прежние 4-8.
 */
const minUnitsPerChar = (stageCount: number) => Math.max(4, stageCount);
const maxUnitsPerChar = (stageCount: number) => 2 * stageCount + 2;

const REL_VARS = new Set(['affection', 'trust', 'tension']);

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : []);

/**
 * Ответ LLM → EventUnit[]. id префиксуется evt_<liId>_; цепочка стадий
 * достраивается АВТОМАТИЧЕСКИ: каждый юнит стадии N>1 получает guard
 * {fired: <последний юнит стадии N-1>} — у LLM её не спрашиваем.
 */
export function parseEventPool(rawText: string, liId: string, stageCount = 3): EventUnit[] {
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
    /** Окно восприимчивости внутри части дня; не указано — дефолт ступени. */
    timing?: UnitTiming;
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
      // Ступень вне лестницы — за её пределы клампим: иначе «ступень 7» при
      // N=5 повисла бы выше вершины и осталась бы недостижимой.
      arcStage: Number.isFinite(stage) ? Math.max(1, Math.min(Math.trunc(stage), stageCount)) : 1,
      goal: String(unit.goal ?? ''),
      locationId: String(unit.locationId),
      window: { fromSlot: Math.trunc(fromSlot), toSlot: Math.trunc(toSlot) },
      // Восприимчивость выбирает генерация от смысла сцены («утешить
      // вымотанного» — late). Мусор молча роняем в дефолт ступени: поле
      // опциональное, ронять из-за него весь пул — несоразмерно.
      timing: isUnitTiming(unit.timing) ? unit.timing : undefined,
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

  // Хвост fired-цепочки для ступени N+1 — юнит ступени N с САМЫМ РАННИМ окном.
  //
  // Раньше брался последний по позиции в массиве, и живой прогон показал цену:
  // модель перечислила поздний юнит последним, гейтом стал он, а все встречи
  // следующей ступени, открытые раньше его окна, стали недостижимы —
  // шесть юнитов Киры (ступени 3-5) молча выпали из игры. Позиция в массиве
  // ничего не значит; смысл гейта — «ступень N пройдена», и самый ранний юнит
  // выражает его наиболее слабо, оставляя следующей ступени максимум окон.
  // Тай-брейк по позиции — детерминизм.
  const prefixed = (rawId: string) => (rawId.startsWith(`evt_${liId}_`) ? rawId : `evt_${liId}_${rawId}`);
  const lastOfStage = new Map<number, string>();
  {
    const earliest = new Map<number, number>();
    for (const s of shells) {
      const from = s.window.fromSlot;
      const best = earliest.get(s.arcStage);
      if (best == null || from < best) {
        earliest.set(s.arcStage, from);
        lastOfStage.set(s.arcStage, prefixed(s.id));
      }
    }
  }

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
      // Фаза ставится ТОЛЬКО из собственного timing юнита; дефолт по ступени
      // доштампует applyLadderGuards — иначе не отличить «модель выбрала any»
      // от «модель промолчала», и дефолт нечего было бы не перетирать.
      at: {
        slot: s.window,
        locationId: s.locationId,
        ...(s.timing ? { phase: phaseWindowForTiming(s.timing) } : {}),
      },
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

  const stageCount = arcStageCount(calendar.days);
  for (const [liId, list] of byChar) {
    const min = minUnitsPerChar(stageCount);
    const max = maxUnitsPerChar(stageCount);
    if (list.length < min || list.length > max) {
      issues.push({
        severity: 'warning',
        scope: `pool/${liId}`,
        message: `у "${liId}" ${list.length} юнитов — целевой диапазон ${min}-${max} для лестницы из ${stageCount} ступеней`,
      });
    }
    // Пропущенная ступень — разрыв в отношениях: соседние сцены разъезжаются,
    // и близость возникает рывком. Ровно то, ради чего лестница.
    const present = new Set(list.map(u => u.arcStage ?? 1));
    for (const stage of requiredArcStages(stageCount)) {
      if (!present.has(stage)) {
        issues.push({
          severity: 'warning',
          scope: `pool/${liId}`,
          message: `у "${liId}" нет ни одной встречи ступени ${stage} из ${stageCount} — лестница с дырой, отношения прыгнут через ступень`,
        });
      }
    }
  }

  // Зависимость обязана УСПЕВАТЬ сработать: если юнит ждёт `fired: V`, то V
  // должен иметь возможность отыграть строго раньше, чем закроется окно юнита.
  //
  // Живой прогон: модель написала цепочку, идущую НАЗАД во времени —
  // `open_up_1` открыт в слотах 1..2, но ждёт `habit_2` из слота 8. Сыграть
  // такое невозможно физически, и вся верхушка арки Киры (ступени 3-5, шесть
  // юнитов) оказалась мёртвой. Ловил это только prune — уже после генерации
  // пула, молчаливым warning'ом «недостижимы», без объяснения причины.
  // Здесь же ошибка уходит в фидбек ретрая и называет виновное окно.
  //
  // Чиним валидацией, а не сдвигом окон: окно связано с локацией и weekly-
  // паттерном персонажа, и подвинуть его молча — значит поставить героя туда,
  // где его в этот слот нет. Выбор нового окна остаётся за моделью.
  //
  // Судим ПОЧИНЕННЫЙ граф — тот же, что увидят компилятор и prune. Иначе
  // валидатор ругается на то, что applyLadderGuards и так исправляет (подъём
  // окна к полу ступени, перецепка гейта на самый ранний юнит), и заворачивает
  // рабочий пул: ровно так этот валидатор с первого же прогона завалил стадию
  // на кэшированном пуле Юки. Ошибка должна оставаться только там, где ремонт
  // бессилен.
  const repaired = applyLadderGuards(units, spine, calendar, brief).units;
  const byId = new Map(repaired.map(u => [u.id, u]));
  for (const unit of repaired) {
    const win = unit.at.slot;
    if (!win) continue;
    for (const depId of guardFiredIds(unit.guard)) {
      const dep = byId.get(depId);
      const depWin = dep?.at.slot;
      if (!dep || !depWin) continue; // висячие ссылки ловит проверка выше
      if (depWin.fromSlot >= win.toSlot) {
        issues.push({
          severity: 'error',
          scope: `units/${unit.id}`,
          message:
            `юнит "${unit.id}" (окно [${win.fromSlot}, ${win.toSlot}]) ждёт "${depId}", ` +
            `но у того окно [${depWin.fromSlot}, ${depWin.toSlot}] — раньше он отыграть не успеет, ` +
            `и встреча недостижима. Сдвинь окно "${unit.id}" так, чтобы оно начиналось после ` +
            `слота ${depWin.fromSlot} (не забудь: локация должна совпадать с расписанием персонажа).`,
        });
      }
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
  targets: { unitsPerStage: number; arcStageCount: number };
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
    // Лестница считается от ФАКТИЧЕСКОГО календаря (в отличие от castPlan,
    // который идёт раньше и берёт цифру из брифа).
    targets: { unitsPerStage: EVENT_POOL_UNITS_PER_STAGE, arcStageCount: arcStageCount(calendar.days) },
  };
}
