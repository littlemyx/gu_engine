import type { Brief, WorldModel } from './types';
import type { Calendar } from './calendarTypes';

export type SpineTargets = {
  beatCount: number;
  branchPointBudget: number;
};

const MIN_BEATS = 6;
const MAX_BEATS = 18;

/**
 * Целевые бюджеты хребта: примерно бит на каждый второй слот — остальные
 * слоты живут на агендных встречах и филлерах, иначе хребет задушит
 * свободное исследование. branchPointBudget = 0 в фазе 1: развилки
 * включаются в фазе 5 вместе с их валидацией.
 */
export function computeSpineTargets(calendar: Calendar): SpineTargets {
  const raw = Math.round(calendar.slotCount * 0.5);
  return {
    beatCount: Math.min(MAX_BEATS, Math.max(MIN_BEATS, raw)),
    branchPointBudget: 0,
  };
}

/**
 * Собирает payload для /generate/spine.
 *
 * null-tagMap уходит как отсутствующее поле: hey-api моделирует
 * nullable-поля как optional, а сервер трактует undefined и null одинаково.
 */
export function buildSpineRequestPayload(
  brief: Brief,
  worldModel: WorldModel,
  calendar: Calendar,
  tagMap: Record<string, string[]> | null,
): {
  brief: Brief;
  worldModel: WorldModel;
  calendar: Calendar;
  tagMap?: Record<string, string[]>;
  targets: SpineTargets;
} {
  return { brief, worldModel, calendar, tagMap: tagMap ?? undefined, targets: computeSpineTargets(calendar) };
}
