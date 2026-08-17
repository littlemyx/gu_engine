import { downstreamOf } from '@/artifacts/stageGraph';

import type { ArtifactKey, ArtifactStage } from '@/artifacts/types';
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

type SeedIssues = NonNullable<BulkCalendarRunOptions['seedIssues']>;

/** Стадии прогона, которые затравки могут отправить на пересборку. */
const SEEDABLE_REDO: ArtifactStage[] = [
  'spine',
  'schedule',
  'beat_prose',
  'anchor_transitions',
  'event_pool',
  'dialogue_units',
  'ending_prose',
];

/**
 * Ключи сметы, которые прогон с этими затравками пересоберёт даже свежими:
 * затравка инвалидирует кэш владеющей стадии, а её регенерация каскадом тянет
 * потомков. Медиа/qa/bundle прогон не производит — их смете не обещаем.
 */
export function redoKeysOf(seeds: SeedIssues): ArtifactKey[] {
  const stages = new Set<ArtifactStage>();
  if ((seeds.spine?.length ?? 0) > 0) stages.add('spine');
  if (Object.keys(seeds.eventPool ?? {}).length > 0) {
    stages.add('event_pool');
    // Граф стадий эту связь не кодирует (диалоги висят на schedule), но по
    // смыслу пул рождает юниты — новый пул означает новую прозу.
    stages.add('dialogue_units');
  }
  for (const stage of [...stages]) {
    for (const below of downstreamOf(stage)) stages.add(below);
  }

  const keys = new Set<string>();
  for (const stage of stages) {
    if (SEEDABLE_REDO.includes(stage)) keys.add(`${stage}/`);
  }
  // Диалоговые затравки адресные: пересоберутся конкретные юниты.
  for (const unitId of Object.keys(seeds.dialogue ?? {})) keys.add(`dialogue_units/${unitId}`);

  return [...keys] as ArtifactKey[];
}

/** Затравки из двух источников (заметки режиссёра + отчёт QA) — одним пакетом. */
export function mergeSeedIssues(a: SeedIssues | undefined, b: SeedIssues | undefined): SeedIssues | undefined {
  if (!a) return b;
  if (!b) return a;
  const mergeRec = (x: Record<string, string[]> = {}, y: Record<string, string[]> = {}) => {
    const out: Record<string, string[]> = { ...x };
    for (const [key, lines] of Object.entries(y)) out[key] = [...(out[key] ?? []), ...lines];
    return out;
  };
  const merged: SeedIssues = {};
  const spine = [...(a.spine ?? []), ...(b.spine ?? [])];
  const dialogue = mergeRec(a.dialogue, b.dialogue);
  const eventPool = mergeRec(a.eventPool, b.eventPool);
  if (spine.length > 0) merged.spine = spine;
  if (Object.keys(dialogue).length > 0) merged.dialogue = dialogue;
  if (Object.keys(eventPool).length > 0) merged.eventPool = eventPool;
  return Object.keys(merged).length > 0 ? merged : undefined;
}
