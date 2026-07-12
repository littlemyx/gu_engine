import type { Brief, SegmentIssue, WorldModel } from './types';
import type { Calendar, CastPlan } from './calendarTypes';

/**
 * Валидация календаря + маппинга агендных тегов стадии worldCalendar.
 * Ошибки идут в retry-with-feedback (previousIssues), warnings — автору.
 */
export function validateCalendar(
  calendar: Calendar,
  brief: Brief,
  worldModel: WorldModel | null,
  tagMap: Record<string, string[]> | null,
  castPlan: CastPlan | null,
): SegmentIssue[] {
  const issues: SegmentIssue[] = [];

  if (calendar.days <= 0) {
    issues.push({ severity: 'error', scope: 'calendar/days', message: `days = ${calendar.days}, ожидается > 0` });
  }
  if (calendar.dayparts.length === 0) {
    issues.push({ severity: 'error', scope: 'calendar/dayparts', message: 'dayparts пуст' });
  }
  if (calendar.slotCount !== calendar.days * calendar.dayparts.length) {
    issues.push({
      severity: 'error',
      scope: 'calendar/slotCount',
      message: `slotCount ${calendar.slotCount} ≠ days×dayparts = ${calendar.days * calendar.dayparts.length}`,
    });
  }

  // Границы актов: столько же, сколько актов; начинаются с 0; строго растут; внутри календаря.
  const ab = calendar.actBoundaries;
  if (ab.length !== brief.scale.acts) {
    issues.push({
      severity: 'error',
      scope: 'calendar/actBoundaries',
      message: `actBoundaries.length = ${ab.length}, актов в брифе ${brief.scale.acts}`,
    });
  }
  if (ab[0] !== 0) {
    issues.push({
      severity: 'error',
      scope: 'calendar/actBoundaries',
      message: 'первый акт должен начинаться с дня 0',
    });
  }
  for (let i = 1; i < ab.length; i++) {
    if (ab[i] <= ab[i - 1]) {
      issues.push({
        severity: 'error',
        scope: 'calendar/actBoundaries',
        message: `границы актов должны строго возрастать: acts[${i}] = ${ab[i]} ≤ acts[${i - 1}] = ${ab[i - 1]}`,
      });
    }
    if (ab[i] >= calendar.days) {
      issues.push({
        severity: 'error',
        scope: 'calendar/actBoundaries',
        message: `граница акта ${i + 1} (день ${ab[i]}) за пределами календаря (${calendar.days} дней)`,
      });
    }
  }

  for (const sd of calendar.specialDays ?? []) {
    if (sd.day < 0 || sd.day >= calendar.days) {
      issues.push({
        severity: 'warning',
        scope: 'calendar/specialDays',
        message: `особый день "${sd.label}" (день ${sd.day}) вне календаря`,
      });
    }
  }

  // Маппинг тегов: каждый агендный тег каста должен вести хотя бы к одной
  // существующей локации, иначе расписание не разложит персонажа по миру.
  if (castPlan && tagMap) {
    const locIds = new Set((worldModel?.locations ?? []).map(l => l.id));
    for (const member of castPlan.members) {
      const tags = new Set<string>([
        ...Object.keys(member.agenda.locationTags),
        ...Object.values(member.agenda.weeklyPattern).flatMap(entries => entries.map(e => e.tag)),
      ]);
      for (const tag of tags) {
        const mapped = tagMap[tag] ?? [];
        if (mapped.length === 0) {
          issues.push({
            severity: 'error',
            scope: `tagMap/${tag}`,
            message: `тег "${tag}" (персонаж ${member.id}) не сопоставлен ни одной локации`,
          });
          continue;
        }
        for (const locId of mapped) {
          if (worldModel && !locIds.has(locId)) {
            issues.push({
              severity: 'error',
              scope: `tagMap/${tag}`,
              message: `тег "${tag}" ссылается на несуществующую локацию "${locId}"`,
            });
          }
        }
      }
    }
  }

  return issues;
}
