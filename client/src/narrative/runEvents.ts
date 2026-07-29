import { emitPipelineEvent } from '@/processes/eventBus';

import type { BulkCalendarPhase } from './calendarRunState';
import type { ArtifactKey, ArtifactStage } from '@/artifacts/types';
import type { EventPhase } from '@/processes/events';

/**
 * Мост между словарём прогона и словарём учёта.
 *
 * Раннер думает стадиями пайплайна (`BulkCalendarPhase`) и своими itemKey —
 * они несут ещё и parse-контекст (у диалогового брекета их три). Лента и
 * инспектор думают адресами артефактов (`ArtifactKey`). Перевод живёт здесь
 * одной таблицей, чтобы в самом раннере остались однострочные вставки, а не
 * россыпь склеек строк по девяти стадиям.
 */

/** Стадия учёта для стадии прогона; null — стадия артефактов не производит. */
export function stageOf(phase: BulkCalendarPhase): ArtifactStage | null {
  const MAP: Record<BulkCalendarPhase, ArtifactStage | null> = {
    idle: null,
    cast: 'cast',
    // Стадия делает сразу два артефакта: календарь — основной адрес, о мире
    // раннер докладывает отдельным событием (см. комментарий в calendarRunner).
    world_calendar: 'calendar',
    spine: 'spine',
    schedule: 'schedule',
    beat_prose: 'beat_prose',
    anchor_transitions: 'anchor_transitions',
    event_pool: 'event_pool',
    // Отсев достижимости не генерирует ничего — учитывать нечего.
    prune: null,
    dialogue_units: 'dialogue_units',
    ending_prose: 'ending_prose',
    done: null,
  };
  return MAP[phase];
}

/**
 * Адрес артефакта для элемента стадии.
 *
 * `event_pool` возвращает null сознательно: генерация идёт пулом на персонажа,
 * а учёт ключует по юнитам — адреса «позиция = один LI» в индексе не
 * существует. Такие события едут без artifactKey, с человеческой подписью.
 */
export function artifactKeyOf(phase: BulkCalendarPhase, itemKey: string | null): ArtifactKey | null {
  const stage = stageOf(phase);
  if (stage == null) return null;
  if (phase === 'event_pool') return null;
  if (itemKey == null) return `${stage}/`;
  // itemKey диалогов несёт parse-контекст: `<unitId>/<bracket>[/qa|/qa-regen]`.
  // Артефакт при этом один на юнит — всё, что после первой косой, отрезаем.
  const slash = itemKey.indexOf('/');
  return `${stage}/${slash === -1 ? itemKey : itemKey.slice(0, slash)}`;
}

export interface RunEventExtra {
  attempt?: number;
  cost?: number;
  reason?: string;
  message?: string;
  /** Адрес поверх выведенного: для артефактов, которых нет в словаре стадии. */
  artifactKey?: ArtifactKey;
}

/** Издать событие прогона. Для стадий без артефактов — ничего не делает. */
export function emitRunEvent(
  runId: string,
  phase: EventPhase,
  bulkPhase: BulkCalendarPhase,
  itemKey: string | null,
  extra: RunEventExtra = {},
): void {
  const stage = stageOf(bulkPhase);
  if (stage == null) return;
  const { artifactKey, ...rest } = extra;
  const key = artifactKey ?? artifactKeyOf(bulkPhase, itemKey) ?? undefined;
  emitPipelineEvent({ runId, phase, stage, artifactKey: key, ...rest });
}
