import type { Brief, SegmentIssue } from './types';
import type { Calendar, EventUnit, SpinePlan } from './calendarTypes';
import {
  arcStageCount,
  ladderClosingGain,
  ladderThreshold,
  phaseWindowForStage,
  stageFloorDay,
  stageFloorSlot,
} from './calendarTypes';
import type { Guard } from './events';
import { ARCHETYPES } from './archetypes';
import { assignBeatSlots } from './beatSchedule';
import { bracketThresholdsFor } from './convertToGameProject';
import { storylineKeys } from './beatChain';

/**
 * Лестница отношений: движок гейтит ступени близости по f(z, R, H).
 *
 * Зачем. Арка была жёстко трёхступенчатой (знакомство → уязвимость →
 * признание), а её ступени — приколочены к окнам актов. На коротком календаре
 * это давало скачок «вчера познакомились — сегодня романтический конфликт»:
 * между «здравствуйте» и «делюсь сокровенным» просто нет промежуточных шагов.
 * Хуже: единственным условием входа на ступень были флаги от LLM, а компилятор
 * МОЛЧА выбрасывал rel-условия — половина модели событий (R) до игры не
 * доезжала.
 *
 * Здесь ступеням выдаются три независимых гейта:
 *   z — пол дня ступени (раньше не сыграть, сколько ни набери affection);
 *   R — rel-порог t(s) от старта архетипа к потолку;
 *   H — fired-цепочка ступеней и one-shot встречи (уже есть в parseEventPool).
 * Ни один прокол промпта не открывает признание в первый день: гейты
 * независимы, и обойти надо все сразу.
 *
 * Выводится ПРИ ЧТЕНИИ (как applyBeatChain) — ничего не хранится, поэтому
 * персистнутые истории получают гейты на компиляции без миграции.
 *
 * План: docs/plans/calendar-branching.md
 */

/** Середина initialState.affection архетипа = дефолт stateSchema этого LI. */
export function archetypeAffectionStart(brief: Brief, liId: string): number {
  const li = brief.loveInterests.find(l => l.id === liId);
  const init = li ? ARCHETYPES[li.archetype]?.initialState?.affection : undefined;
  return init ? (init[0] + init[1]) / 2 : 0;
}

/**
 * Ступеней в лестнице ЭТОГО пула. Персистнутые пулы (жёсткие стадии 1..3) не
 * ломаются: N берётся из фактических данных, а не из календаря, поэтому старая
 * история гейтится трёхступенчатой лестницей, а новая — своей.
 */
export function effectiveStageCount(units: EventUnit[], calendar: Calendar): number {
  // Высота лестницы — по ФАКТИЧЕСКОМУ пулу, не по календарю: генерация целится
  // в arcStageCount(days), но гейтить надо ровно то, что сгенерировано, иначе
  // у персистнутой 3-ступенчатой истории пороги поедут вверх без её ведома.
  const maxStage = units.reduce((m, u) => Math.max(m, u.arcStage ?? 1), 1);
  return Math.max(3, Math.min(maxStage, arcStageCount(calendar.days)));
}

/**
 * Самая высокая ступень, до которой игрок может дорасти к слоту `bySlot`:
 * максимум по встречам этого LI, которые к тому моменту УЖЕ открыты (их окно
 * началось). Ограничитель против недостижимых порогов: пул из ступеней 1-2 не
 * даёт права требовать вершину лестницы.
 */
export function maxStagePlayableBefore(units: EventUnit[], liId: string, bySlot: number): number {
  let max = 1;
  for (const u of units) {
    if (u.kind !== 'dialogue' || u.participants[0] !== liId || !u.at.slot) continue;
    if (u.at.slot.fromSlot <= bySlot) max = Math.max(max, u.arcStage ?? 1);
  }
  return max;
}

/** Ступень бита LI: по назначенному дню, обратной к stageFloorDay функцией. */
export function beatStage(day: number, stageCount: number, days: number): number {
  let stage = 1;
  for (let s = 1; s <= stageCount; s++) {
    if (stageFloorDay(s, stageCount, days) <= day) stage = s;
  }
  return stage;
}

const asConjunction = (guard: Guard): Guard[] => ('all' in guard ? guard.all : [guard]);

/** rel-пороги affection, уже присутствующие в конъюнкции (для идемпотентности). */
const relFloorsOf = (guard: Guard): number[] =>
  asConjunction(guard).flatMap(g =>
    'rel' in g && g.rel.var === 'affection' && (g.rel.op === '>=' || g.rel.op === '>') ? [g.rel.value] : [],
  );

/** Добавляет {rel: affection >= value}, если такой порог ещё не стоит. */
function withRelFloor(guard: Guard, value: number): Guard {
  if (value <= 0) return guard;
  if (relFloorsOf(guard).some(v => Math.abs(v - value) < 1e-9)) return guard;
  return { all: [...asConjunction(guard), { rel: { var: 'affection', op: '>=', value } } as Guard] };
}

export type LadderPlan = {
  /** Число ступеней, по которому считались пороги. */
  stageCount: number;
  /** unitId → детерминированный гейн affection на closing встречи. */
  closingGain: Map<string, number>;
  /** liId → стартовый affection архетипа (A0). */
  startByLi: Map<string, number>;
  issues: SegmentIssue[];
};

export type LadderResult = {
  units: EventUnit[];
  spine: SpinePlan;
  plan: LadderPlan;
};

/**
 * Канонная идемпотентная точка входа: пул + хребет → они же с гейтами лестницы.
 * Обязана вызываться ОДИНАКОВО у всех читателей (компилятор, валидаторы,
 * prune/филлеры раннера, story QA) — иначе игра, валидатор и QA разойдутся.
 */
export function applyLadderGuards(
  units: EventUnit[],
  spine: SpinePlan,
  calendar: Calendar,
  brief: Brief,
): LadderResult {
  const issues: SegmentIssue[] = [];
  const stageCount = effectiveStageCount(units, calendar);
  const liIds = new Set(brief.loveInterests.map(li => li.id));
  const startByLi = new Map(brief.loveInterests.map(li => [li.id, archetypeAffectionStart(brief, li.id)]));
  const closingGain = new Map<string, number>();

  const lastSlot = calendar.slotCount - 1;
  const perDay = calendar.dayparts.length;

  // Гейт ступени — самый РАННИЙ юнит предыдущей ступени той же линии.
  //
  // parseEventPool цепляет ступень N за юнит N−1, и раньше выбирал его по
  // позиции в массиве. Живой прогон показал цену: модель перечислила поздний
  // юнит последним, гейтом стал он, и вся верхушка арки Киры (ступени 3-5,
  // шесть юнитов) стала недостижима — встречи открывались раньше, чем их гейт
  // вообще мог сработать. Парсер исправлен, но цепочка ЗАПЕЧЕНА в сохранённых
  // юнитах: без перецепки на чтении уже сгенерированные (оплаченные) истории
  // остались бы сломанными. Поэтому — здесь, канонной точкой чтения, как и
  // остальная лестница: миграция не нужна, старые истории чинятся компиляцией.
  const earliestOfStage = new Map<string, EventUnit>();
  for (const u of units) {
    const liId = u.participants[0] ?? '';
    if (u.kind !== 'dialogue' || !liIds.has(liId) || !u.at.slot) continue;
    const key = `${liId}#${u.arcStage ?? 1}`;
    const best = earliestOfStage.get(key);
    if (!best || u.at.slot.fromSlot < best.at.slot!.fromSlot) earliestOfStage.set(key, u);
  }
  const unitIds = new Set(units.map(u => u.id));
  /** Перевешивает fired-ссылки на юниты той же линии к правильному гейту. */
  const relinkGate = (guard: Guard, liId: string, stage: number): Guard => {
    if (stage < 2) return guard;
    const gate = earliestOfStage.get(`${liId}#${stage - 1}`);
    if (!gate) return guard;
    const walk = (g: Guard): Guard => {
      if ('fired' in g && unitIds.has(g.fired) && g.fired !== gate.id) {
        // Ссылка на юнит СВОЕЙ линии — это и есть автоцепочка ступеней.
        const target = units.find(x => x.id === g.fired);
        if (target && (target.participants[0] ?? '') === liId) return { fired: gate.id };
      }
      if ('all' in g) return { all: g.all.map(walk) };
      if ('any' in g) return { any: g.any.map(walk) };
      return g;
    };
    return walk(guard);
  };

  const nextUnits = units.map(u => {
    const liId = u.participants[0] ?? '';
    if (u.kind !== 'dialogue' || !liIds.has(liId) || !u.at.slot) return u;
    const stage = Math.max(1, Math.min(u.arcStage ?? 1, stageCount));
    const a0 = startByLi.get(liId)!;

    closingGain.set(u.id, ladderClosingGain(a0, stage, stageCount));

    // H: гейт ступени — к самому раннему юниту предыдущей (см. выше).
    // R: порог входа. Ступень 1 — точка входа в линию, порога не несёт.
    const gated = relinkGate(u.guard, liId, stage);
    const guard = stage >= 2 ? withRelFloor(gated, ladderThreshold(a0, stage, stageCount)) : gated;

    // z: пол дня. Поднимая fromSlot, ОБЯЗАТЕЛЬНО тянем toSlot — иначе окно
    // инвертируется, юнит мёртв, а вместе с ним вся fired-цепочка ступеней
    // (parseEventPool цепляет каждую ступень за хвост предыдущей).
    const floor = Math.min(stageFloorSlot(stage, stageCount, calendar), lastSlot);
    let { fromSlot, toSlot } = u.at.slot;
    if (fromSlot < floor) {
      fromSlot = floor;
      toSlot = Math.max(toSlot, Math.min(lastSlot, floor + perDay - 1));
    }
    if (fromSlot > toSlot) {
      issues.push({
        severity: 'error',
        scope: `ladder/${u.id}`,
        message: `окно юнита "${u.id}" (ступень ${stage}) после подъёма к полу дня пусто: [${fromSlot}, ${toSlot}] — ступень недостижима, цепочка арки оборвётся`,
      });
    }

    // Малая стрелка: дефолт окна восприимчивости по ступени — но ТОЛЬКО если
    // юнит не назвал своё. Восприимчивость — свойство сцены, а не позиции в
    // слоте: «подбодрить вымотанную к концу смены» обязано открываться поздно,
    // и дефолт «глубокое — на свежую голову» такую арку бы запретил.
    const phase = u.at.phase ?? phaseWindowForStage(stage);

    const windowSame = fromSlot === u.at.slot.fromSlot && toSlot === u.at.slot.toSlot;
    if (guard === u.guard && windowSame && u.at.phase) return u;
    return { ...u, guard, at: { ...u.at, slot: { fromSlot, toSlot }, phase } };
  });

  // Биты LI — в той же лестнице. Без этого репортнутый скачок выживает в форме
  // бита: «признание в парке» гейтилось бы только знакомством, а не близостью.
  //
  // Порог — по ПЕРВИЧНОМУ участнику: лист {rel} в грамматике не несёт id
  // персонажа (evalGuard читает отношения с ctx.x = participants[0]), поэтому
  // два порога на мульти-LI бите были бы неразличимы, а симулятор и игра
  // разошлись бы. Гейт по первичному LI — единственная честная трактовка.
  const beatSlots = assignBeatSlots(spine, calendar);
  const nextBeats = spine.beats.map(b => {
    if (b.kind === 'finale') return b; // финал безусловен и конвергентен
    const primary = storylineKeys(b, liIds).find(k => liIds.has(k));
    if (!primary) return b;
    const slot = beatSlots[b.id] ?? b.window.fromSlot;
    const day = Math.floor(slot / perDay);
    // Ступень по календарю — но НЕ выше той, до которой пул даёт дорасти к
    // этому моменту. Иначе бит на позднем дне требует потолок лестницы, а в
    // пуле, скажем, одни ступени 1-2: сцена недостижима навсегда, и это не
    // «строгий гейт», а мёртвый контент. Требовать близости больше, чем
    // история даёт заработать, нельзя.
    const reachable = maxStagePlayableBefore(nextUnits, primary, b.window.fromSlot);
    const stage = Math.min(beatStage(day, stageCount, calendar.days), reachable);
    if (stage < 2) return b;
    const guard = withRelFloor(b.guard, ladderThreshold(startByLi.get(primary)!, stage, stageCount));
    return guard === b.guard ? b : { ...b, guard };
  });

  return {
    units: nextUnits,
    spine: { ...spine, beats: nextBeats },
    plan: { stageCount, closingGain, startByLi, issues },
  };
}

/**
 * Холодная проза недостижима, если вход на ступень требует тепла выше
 * холодного порога: игрок такую ветку не увидит никогда, а генерация стоит
 * денег.
 *
 * ОДНА точка истины на всех потребителей (раннер пропускает генерацию, story QA
 * не требует прозы, qaSeeds не гонит перегенерацию). Разъедься они — QA будет
 * краснеть на каждую новую историю и вхолостую перегенерировать пул.
 */
export function skipsNegativeBracket(unit: EventUnit, brief: Brief, calendar: Calendar, units: EventUnit[]): boolean {
  const liId = unit.participants[0] ?? '';
  if (!brief.loveInterests.some(l => l.id === liId)) return false;
  const stageCount = effectiveStageCount(units, calendar);
  const stage = Math.max(1, Math.min(unit.arcStage ?? 1, stageCount));
  // Ступень 1 — вход в линию: она открыта и холодному игроку, её холодная
  // проза нужна (и ведёт к плохой концовке).
  if (stage < 2) return false;
  const a0 = archetypeAffectionStart(brief, liId);
  return ladderThreshold(a0, stage, stageCount) > bracketThresholdsFor(a0).negativeLte;
}
