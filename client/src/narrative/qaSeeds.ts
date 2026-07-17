import type { SegmentIssue } from './types';
import type { EventUnit } from './calendarTypes';
import type { BulkCalendarRunOptions } from './calendarRunState';

/**
 * Маршрутизация issue-строк Story QA в затравки «перегенерировать с фидбеком»:
 * каждая группа отчёта должна доезжать до стадии, которая ВЛАДЕЕТ причиной,
 * иначе кнопка честно перегенерирует не то (и warning переживает любое число
 * прогонов):
 *
 *   spine/…, leaf/…      → хребет (структура битов и листья судят его);
 *   sim/…                → хребет (окна битов) И пулы событий — «мёртвые слоты»
 *                          это в основном плотность пула: юниты не покрывают
 *                          слоты×локации, а validateEventUnits покрытие не
 *                          меряет, так что фидбек — единственный канал;
 *   qa/deadContent       → хребет (branch-гейтинг) И пулы владельцев мёртвых
 *                          юнитов;
 *   dialogue/<unitId>/…  → диалоговая проза юнита.
 *
 * Остальные группы (calendar/schedule/units/qa/prose/qa/flags) намеренно не
 * сидируются: их чинят детерминированные стадии или сами валидаторы стадий.
 */

const qaGroupOf = (issue: SegmentIssue): string => issue.scope.split('/')[0] || '?';

const seedLine = (i: SegmentIssue): string => `[${i.severity}] ${i.scope}: ${i.message}`;

/** Политики симуляции, чьи мёртвые слоты — общие (не про конкретного LI). */
const isSharedSimPolicy = (scope: string): boolean =>
  scope.startsWith('sim/round-robin') || scope.startsWith('sim/seeded-random');

export function buildSeedIssues(
  issues: SegmentIssue[],
  eventUnits: EventUnit[],
  liIds: string[],
): BulkCalendarRunOptions['seedIssues'] {
  const spine: string[] = [];
  const dialogue: Record<string, string[]> = {};
  const eventPool: Record<string, string[]> = {};
  const poolSeed = (liId: string, line: string) => {
    if (!liId) return;
    (eventPool[liId] ??= []).push(line);
  };

  for (const i of issues) {
    const group = qaGroupOf(i);
    const line = seedLine(i);

    if (group === 'spine' || group === 'leaf') {
      spine.push(line);
      continue;
    }

    if (group === 'sim') {
      spine.push(line);
      if (i.scope.startsWith('sim/greedy-li:')) {
        poolSeed(i.scope.slice('sim/greedy-li:'.length).split('/')[0], line);
      } else if (isSharedSimPolicy(i.scope)) {
        for (const liId of liIds) poolSeed(liId, line);
      }
      // sim/spine-only ходит только по битам — пул ни при чём.
      continue;
    }

    // coverage/<li>: в расписании есть слот, где с LI нечем заговорить.
    // Синтез филлеров закрывает дыру технически, но осмысленную встречу туда
    // должен положить пул этого персонажа — ему и фидбек.
    if (group === 'coverage') {
      poolSeed(i.scope.slice('coverage/'.length).split('/')[0], line);
      continue;
    }

    if (i.scope === 'qa/deadContent') {
      spine.push(line);
      // Владельцы мёртвых юнитов — по упоминанию id в тексте (список в message
      // обрезается после 5; потерянных владельцев докроет spine-затравка).
      const owners = new Set(eventUnits.filter(u => i.message.includes(u.id)).map(u => u.participants[0] ?? ''));
      for (const liId of owners) poolSeed(liId, line);
      continue;
    }

    if (group === 'dialogue') {
      const unitId = i.scope.split('/')[1];
      if (unitId) (dialogue[unitId] ??= []).push(line);
    }
  }

  const seeds: NonNullable<BulkCalendarRunOptions['seedIssues']> = {};
  if (spine.length > 0) seeds.spine = spine;
  if (Object.keys(dialogue).length > 0) seeds.dialogue = dialogue;
  if (Object.keys(eventPool).length > 0) seeds.eventPool = eventPool;
  return Object.keys(seeds).length > 0 ? seeds : undefined;
}
