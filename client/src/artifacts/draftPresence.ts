import type { CalendarDraft } from '@/narrative/calendarRunState';
import type { ArtifactKey } from './types';

/**
 * Ключи артефактов, уже посчитанные в черновике незакоммиченного прогона.
 *
 * Черновик — не история: в индекс артефактов он попадает только коммитом
 * (recordRunCommit). Но для сметы и ведомости он не пустое место: работа
 * сделана и оплачена, продолжение прогона возьмёт её из кэша бесплатно.
 * Без этого списка смета после сбоя обещает полную цену (E2E: ≈$6.32 при
 * готовой половине), а «Пайплайн» показывает ноль готового при «готово 4»
 * во вкладке «Прогоны».
 */
export function draftKeys(draft: CalendarDraft | null | undefined): ArtifactKey[] {
  if (!draft) return [];
  const keys: string[] = [];

  if (draft.castPlan) keys.push('cast/');
  if (draft.worldModel) keys.push('world/');
  if (draft.calendar) keys.push('calendar/');
  if (draft.spine) keys.push('spine/');
  if (draft.schedule) keys.push('schedule/');
  if (draft.anchorNarrations) keys.push('anchor_transitions/');
  for (const id of Object.keys(draft.eventUnits ?? {})) keys.push(`event_pool/${id}`);
  for (const id of Object.keys(draft.unitProse ?? {})) keys.push(`dialogue_units/${id}`);
  for (const id of Object.keys(draft.spineBeatProse ?? {})) keys.push(`beat_prose/${id}`);
  for (const id of Object.keys(draft.endings ?? {})) keys.push(`ending_prose/${id}`);

  return keys as ArtifactKey[];
}

/**
 * Покрыт ли ключ сметы черновиком. Плейсхолдер нетронутой стадии (`stage/`)
 * считается покрытым, если черновик держит хоть один элемент стадии: смета не
 * знает будущего состава, но знает, что стадия уже начата и кэш есть.
 */
export function coveredByDraft(key: ArtifactKey, draft: ReadonlySet<string>): boolean {
  if (draft.has(key)) return true;
  if (!key.endsWith('/')) return false;
  for (const candidate of draft) {
    if (candidate.startsWith(key)) return true;
  }
  return false;
}
