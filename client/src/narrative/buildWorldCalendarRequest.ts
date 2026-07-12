import type { Brief } from './types';
import type { CalendarTargets, CastPlan } from './calendarTypes';
import { computeCalendarTargets } from './calendarTypes';

export type WorldCalendarTargets = CalendarTargets & {
  /** Число актов из брифа — длина actBoundaries календаря. */
  acts: number;
};

/**
 * Собирает payload для /generate/worldCalendar: бриф как-есть, агенды каста
 * (стаб или LLM) и целевые размеры календаря из brief.scale.
 *
 * null-castPlan уходит как отсутствующее поле: hey-api моделирует
 * nullable-поля как optional, а сервер трактует undefined и null одинаково.
 */
export function buildWorldCalendarRequestPayload(
  brief: Brief,
  castPlan: CastPlan | null,
): { brief: Brief; castPlan?: CastPlan; targets: WorldCalendarTargets } {
  return {
    brief,
    castPlan: castPlan ?? undefined,
    targets: {
      ...computeCalendarTargets(brief.scale.targetDurationMinutes),
      acts: brief.scale.acts,
    },
  };
}
