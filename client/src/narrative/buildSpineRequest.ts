import type { Brief, WorldModel } from './types';
import type { Calendar } from './calendarTypes';

export type SpineTargets = {
  beatCount: number;
  branchPointBudget: number;
};

const MIN_BEATS = 6;
const MAX_BEATS = 18;
const MAX_BRANCH_POINTS = 3;

/**
 * Целевые бюджеты хребта: примерно бит на каждый второй слот — остальные
 * слоты живут на агендных встречах и филлерах, иначе хребет задушит
 * свободное исследование. branchPointBudget берётся из brief.scale
 * (фаза 5: истинные ветки), клампится в [0, 3] — листьев ≤ 27.
 */
export function computeSpineTargets(calendar: Calendar, brief: Brief): SpineTargets {
  const raw = Math.round(calendar.slotCount * 0.5);
  const budget = Math.trunc(brief.scale.branchPointBudget ?? 0);
  return {
    beatCount: Math.min(MAX_BEATS, Math.max(MIN_BEATS, raw)),
    branchPointBudget: Math.min(MAX_BRANCH_POINTS, Math.max(0, budget)),
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
  return { brief, worldModel, calendar, tagMap: tagMap ?? undefined, targets: computeSpineTargets(calendar, brief) };
}
