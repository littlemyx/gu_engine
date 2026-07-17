import type { SegmentIssue } from './types';
import type { Calendar, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import type { Guard } from './events';
import { guardFiredIds } from './events';
import { assignBeatSlots, beatSelectors, outcomeFlagIndex } from './beatSchedule';

/**
 * Цепочка битов: движок навязывает ПОРЯДОК сюжетной линии.
 *
 * Зачем. Бит созревает по «ещё не сыгран + окно акта + guard-флаги»
 * (compileCalendarGame). Порядок держали только `requires`-флаги от LLM, а он
 * проставляет их ненадёжно (часто пусто) — с пустым requires и окном,
 * расширенным до акта, интимный бит стреляет при первом же входе в локацию
 * («признание от незнакомки»). Пул событий такую проблему уже решил:
 * юнит стадии N получает {fired: хвост стадии N-1} (parseEventPool), компилятор
 * гейтит его по unit[dep] ≥ 1. Здесь тот же механизм переносится на биты.
 *
 * Порядок ВЫВОДИТСЯ при чтении из assignBeatSlots (детерминирован, branch-aware,
 * им же пользуются валидатор и reachability) — ничего не хранится, поэтому
 * персистнутые хребты чинятся на компиляции без миграции стора.
 *
 * План: docs/plans/calendar-branching.md
 */

/** Линия бита без реальных LI — сюжетная (плейсхолдеры "$role" сюда же). */
export const PLOT_LINE = '$plot';

/** Бит вне цепочки: финал безусловен и конвергентен (инвариант validateSpine). */
const isChainable = (b: SpineBeat): boolean => b.kind !== 'finale';

/**
 * Ключи сюжетных линий бита: его реальные LI-участники. Плейсхолдеры ролей
 * ("$closestLI") и id вне брифа не резолвятся в персонажа на этапе сборки,
 * поэтому бит без реальных LI идёт в общую линию $plot.
 */
export function storylineKeys(beat: SpineBeat, liIds: Set<string>): string[] {
  const lis = beat.participants.filter(p => liIds.has(p));
  return lis.length > 0 ? lis : [PLOT_LINE];
}

/** selectors(a) ⊆ selectors(b) — по парам {развилка: исход}. */
const selectorsSubset = (a: Map<string, string>, b: Map<string, string>): boolean => {
  for (const [bp, outcome] of a) if (b.get(bp) !== outcome) return false;
  return true;
};

export type BeatChain = {
  /** beatId → id битов-предшественников (конъюнкция по всем линиям бита). */
  predecessors: Map<string, string[]>;
  /** Биты без предшественника внутри линии: линия → id головы. */
  heads: Map<string, string>;
  /** Неоднозначный порядок: окна битов одной линии пересекаются. */
  issues: SegmentIssue[];
};

/**
 * Вывод цепочки. Предшественник бита X в линии L — ближайший по назначенному
 * слоту более ранний бит Y той же линии, чьи ветка-селекторы ⊆ селекторов X.
 *
 * Подмножественное правило — гарантия leaf-safety: на любом листе, где guard X
 * выполним, выполним и guard Y, значит Y играется всюду, где может X, и
 * цепочка не делает X мёртвым. Оно же корректно пропускает биты
 * взаимоисключающей ветки (Y требует «выбрал А», X — «выбрал Б»).
 */
export function deriveBeatChain(spine: SpinePlan, calendar: Calendar, liIds: Set<string>): BeatChain {
  const slots = assignBeatSlots(spine, calendar);
  const idx = outcomeFlagIndex(spine);
  const selectorsOf = new Map(spine.beats.map(b => [b.id, beatSelectors(b, idx)]));
  const slotOf = (b: SpineBeat): number => slots[b.id] ?? b.window.fromSlot;

  // Линия → её биты по возрастанию слота (тай-брейк id — детерминизм).
  const byLine = new Map<string, SpineBeat[]>();
  for (const b of spine.beats) {
    if (!isChainable(b)) continue;
    for (const key of storylineKeys(b, liIds)) {
      const list = byLine.get(key) ?? [];
      list.push(b);
      byLine.set(key, list);
    }
  }
  for (const list of byLine.values()) {
    list.sort((a, b) => slotOf(a) - slotOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  const predecessors = new Map<string, string[]>();
  const heads = new Map<string, string>();
  const issues: SegmentIssue[] = [];

  for (const [line, list] of byLine) {
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      const selX = selectorsOf.get(x.id)!;
      // Идём назад от ближайшего более раннего бита линии.
      let pred: SpineBeat | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const y = list[j];
        if (slotOf(y) >= slotOf(x)) continue; // тот же слот — не предшественник
        if (selectorsSubset(selectorsOf.get(y.id)!, selX)) {
          pred = y;
          break;
        }
      }
      if (pred) {
        const list2 = predecessors.get(x.id) ?? [];
        if (!list2.includes(pred.id)) list2.push(pred.id);
        predecessors.set(x.id, list2);
      } else if (!heads.has(line)) {
        heads.set(line, x.id);
      }
    }

    // Порядок внутри линии берётся из assignBeatSlots, а тот сортирует по
    // (toSlot, fromSlot, id) — это артефакт УПАКОВКИ, не авторский замысел.
    // У битов с пересекающимися окнами порядок решает тай-брейк по id, поэтому
    // «признание раньше знакомства» здесь возможно — предупреждаем автора
    // вместо тихого навязывания, возможно, неверной последовательности.
    if (line !== PLOT_LINE) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (a.window.fromSlot <= b.window.toSlot && b.window.fromSlot <= a.window.toSlot) {
            issues.push({
              severity: 'warning',
              scope: `order/ambiguous/${line}`,
              message: `биты "${a.id}" и "${b.id}" линии "${line}" имеют пересекающиеся окна [${a.window.fromSlot}, ${a.window.toSlot}] и [${b.window.fromSlot}, ${b.window.toSlot}] — их порядок решает упаковка, а не замысел; сузьте окна, если порядок важен`,
            });
          }
        }
      }
    }
  }

  return { predecessors, heads, issues };
}

/** Плоские leaf-ы guard-а в конъюнкции верхнего уровня (контракт LLM: {all:[…]}). */
const asConjunction = (guard: Guard): Guard[] => ('all' in guard ? guard.all : [guard]);

/**
 * Мерж fired-зависимостей в guard-ы битов. Идемпотентен: уже присутствующие
 * {fired: id} не дублируются, поэтому повторный вызов (компилятор + валидатор +
 * QA над одним хребтом) даёт тот же результат.
 */
function mergeFiredDeps(spine: SpinePlan, depsOf: (beat: SpineBeat) => string[]): SpinePlan {
  return {
    ...spine,
    beats: spine.beats.map(b => {
      const have = new Set(guardFiredIds(b.guard));
      const add = depsOf(b).filter(d => !have.has(d));
      if (add.length === 0) return b;
      return { ...b, guard: { all: [...asConjunction(b.guard), ...add.map(d => ({ fired: d } as Guard))] } };
    }),
  };
}

/**
 * Единственная канонная точка входа: хребет → хребет с навязанным порядком.
 * Вызывается в начале компилятора, validateSpine и storyQA — все потребители
 * обязаны видеть ОДИН и тот же граф, иначе игра, валидатор и QA разойдутся.
 *
 * `units` (диалоговые юниты пула + синтезированные филлеры) нужны для гейтов на
 * разговоры: см. deriveInteractionGates.
 */
export function applyBeatChain(
  spine: SpinePlan,
  calendar: Calendar,
  liIds: Set<string>,
  units: EventUnit[] = [],
): SpinePlan {
  const chain = deriveBeatChain(spine, calendar, liIds);
  const gates = deriveInteractionGates(spine, liIds, units);
  return mergeFiredDeps(spine, b => [...(chain.predecessors.get(b.id) ?? []), ...(gates.get(b.id) ?? [])]);
}

/**
 * Гейт на разговоры — разблокировка ИЗ СТРУКТУРЫ, а не из бинаря
 * preExistingRelationship.
 *
 * Ради чего всё: цепочка beat→beat навязывает порядок СЮЖЕТНЫХ сцен, но сама по
 * себе не требует, чтобы игрок хоть раз поговорил с персонажем. В реальном
 * прогоне это и сломалось: бит-знакомство срабатывал сам при входе в кафе
 * (enter-роутер уводит в бит ДО хаба, кнопок игрок не видел), ставил met_yuki —
 * и признание в парке открывалось, не требуя НИ ОДНОГО разговора. При этом у
 * пула событий своя честная арка (наблюдение → разговор → мечты), которую бит
 * просто обходил.
 *
 * Поэтому гейтим КАЖДЫЙ бит LI (не только голову линии) на ПОСЛЕДНЮЮ встречу с
 * этим персонажем, доступную строго раньше окна бита. «Последнюю», а не первую:
 * пройденный разговор — мера продвижения по арке, и интимная сцена обязана
 * стоять за самым свежим из них.
 *
 * Достаточно, чтобы встреча ОТКРЫВАЛАСЬ строго раньше окна бита (fromSlot <
 * fromSlot), а не закрывалась до него. Раньше требовалось «toSlot юнита <
 * fromSlot бита» ровно потому, что движок тратил слот на закрытии встречи;
 * тариф отменён (разговор тратит фазу, не слот), и это требование стало
 * беспричинно жёстким: юнит, чьё окно лишь ЗАХОДИТ на окно бита, честно
 * играется в своих ранних слотах и годится в гейты. Чем больше битов LI
 * гейтнуто, тем меньше шансов у репортнутого бага «признание без разговора».
 *
 * Но строгость по ОТКРЫТИЮ обязательна: при «пересечении окон» гейтом бита-
 * знакомства стал бы разговор из того же окна, и игрок вёл бы полную беседу с
 * персонажем ДО сцены первого знакомства — та же инверсия порядка, наизнанку.
 *
 * Голова линии обычно гейта не получает (до неё встреч нет) — знакомство
 * остаётся входной точкой. preExistingRelationship сюда не входит намеренно:
 * «шапочно знакомы» — это тон прозы (encounterContext), а не право на интимную
 * сцену без единой встречи. Линия $plot гейтов не получает: её условия уже
 * выражены флагами guard-а.
 */
function deriveInteractionGates(spine: SpinePlan, liIds: Set<string>, units: EventUnit[]): Map<string, string[]> {
  const gates = new Map<string, string[]>();
  for (const b of spine.beats) {
    if (!isChainable(b)) continue;
    for (const line of storylineKeys(b, liIds)) {
      if (line === PLOT_LINE) continue;
      const gate = gatingUnitFor(line, b, units);
      if (!gate) continue;
      const list = gates.get(b.id) ?? [];
      if (!list.includes(gate)) list.push(gate);
      gates.set(b.id, list);
    }
  }
  return gates;
}

/** Последняя встреча с LI, открывающаяся строго раньше бита; детерминированно по (fromSlot, id). */
export function gatingUnitFor(liId: string, beat: SpineBeat, units: EventUnit[]): string | null {
  const candidates = units
    .filter(u => u.kind === 'dialogue' && u.participants[0] === liId && u.at.slot != null)
    .filter(u => u.at.slot!.fromSlot < beat.window.fromSlot)
    .sort((a, b) => a.at.slot!.fromSlot - b.at.slot!.fromSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return candidates[candidates.length - 1]?.id ?? null;
}
