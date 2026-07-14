import type { Brief, SegmentIssue } from './types';
import type { CastPlan } from './calendarTypes';
import { DEFAULT_DAYPARTS } from './calendarTypes';

/**
 * Валидация castPlan (стадия A1) против брифа.
 *
 * Ошибки идут в retry-with-feedback (previousIssues) LLM-стадии cast;
 * warnings показываются автору. Контракт — форма parseCastPlan:
 * members[{id, isLI, agenda:{goals, weeklyPattern, locationTags}}].
 */

/** Стадии арки, которые обязаны покрывать цели каждого персонажа. */
export const REQUIRED_ARC_STAGES = [1, 2, 3];

export function validateCastPlan(plan: CastPlan, brief: Brief): SegmentIssue[] {
  const issues: SegmentIssue[] = [];

  // Состав: ровно id LI брифа — ни пропущенных, ни лишних.
  const briefIds = new Set(brief.loveInterests.map(li => li.id));
  const planIds = new Set(plan.members.map(m => m.id));
  for (const id of briefIds) {
    if (!planIds.has(id)) {
      issues.push({ severity: 'error', scope: 'members', message: `LI "${id}" из брифа отсутствует в castPlan` });
    }
  }
  for (const id of planIds) {
    if (!briefIds.has(id)) {
      issues.push({
        severity: 'error',
        scope: 'members',
        message: `персонаж "${id}" не найден среди LI брифа — лишний member`,
      });
    }
  }

  for (const member of plan.members) {
    const scope = `members/${member.id}`;
    const { goals, weeklyPattern, locationTags } = member.agenda;

    // Цели: непусты и покрывают стадии арки 1..3.
    if (goals.length === 0) {
      issues.push({ severity: 'error', scope: `${scope}/goals`, message: `у "${member.id}" нет ни одной цели` });
    } else {
      const stages = new Set(goals.map(g => g.arcStage));
      for (const stage of REQUIRED_ARC_STAGES) {
        if (!stages.has(stage)) {
          issues.push({
            severity: 'error',
            scope: `${scope}/goals`,
            message: `цели "${member.id}" не покрывают стадию арки ${stage} (нужны 1=знакомство, 2=сближение, 3=кульминация)`,
          });
        }
      }
    }

    // Weekly-паттерн: запись на КАЖДУЮ часть дня.
    for (const daypart of DEFAULT_DAYPARTS) {
      const entries = weeklyPattern[daypart] ?? [];
      if (entries.length === 0) {
        issues.push({
          severity: 'error',
          scope: `${scope}/weeklyPattern`,
          message: `у "${member.id}" нет записей weeklyPattern для части дня "${daypart}"`,
        });
      }
    }

    // Каждый тег паттерна объявлен в locationTags; веса положительны.
    for (const [daypart, entries] of Object.entries(weeklyPattern)) {
      for (const entry of entries) {
        if (!(entry.tag in locationTags)) {
          issues.push({
            severity: 'error',
            scope: `${scope}/weeklyPattern`,
            message: `тег "${entry.tag}" (${daypart}) не объявлен в locationTags персонажа "${member.id}"`,
          });
        }
        if (!(entry.weight > 0)) {
          issues.push({
            severity: 'warning',
            scope: `${scope}/weeklyPattern`,
            message: `вес тега "${entry.tag}" (${daypart}) у "${member.id}" равен ${entry.weight} — ожидается > 0`,
          });
        }
      }
    }
  }

  return issues;
}
