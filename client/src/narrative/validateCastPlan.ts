import type { Brief, SegmentIssue } from './types';
import type { CastPlan } from './calendarTypes';
import { DEFAULT_DAYPARTS, requiredArcStages } from './calendarTypes';

/**
 * Валидация castPlan (стадия A1) против брифа.
 *
 * Ошибки идут в retry-with-feedback (previousIssues) LLM-стадии cast;
 * warnings показываются автору. Контракт — форма parseCastPlan:
 * members[{id, isLI, agenda:{goals, weeklyPattern, locationTags}}].
 */

/** Легаси-лестница: три ступени. Дефолт для вызовов без stageCount. */
export const REQUIRED_ARC_STAGES = [1, 2, 3];

export function validateCastPlan(
  plan: CastPlan,
  brief: Brief,
  stageCount: number = REQUIRED_ARC_STAGES.length,
): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const stages = requiredArcStages(stageCount);

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

    // Цели: непусты и покрывают КАЖДУЮ ступень лестницы 1..N. Число ступеней
    // считается от длины истории: на трёх ступенях «знакомство → уязвимость →
    // признание» соседние сцены расходятся на пропасть, и близость возникает
    // рывком. Промежуточные ступени и есть плавность.
    //
    // Пустые цели — ОШИБКА (арки нет вовсе), а дыра в лестнице — ЗАМЕЧАНИЕ.
    // Живой прогон объяснил почему: модель уверенно даёт 4 ступени из 5 и
    // спотыкается на последней. Пока это была ошибка, три такие попытки роняли
    // стадию в стаб — а у стаба целей НОЛЬ. Из-за одной недостающей ступени
    // терялась вся арка. Лестница из 4 ступеней несравнимо лучше пустоты, и
    // движок с ней работает штатно: высота берётся по факту (effectiveStageCount).
    // Дожимать до N — дело фидбека ретрая (замечания в него тоже уходят).
    if (goals.length === 0) {
      issues.push({ severity: 'error', scope: `${scope}/goals`, message: `у "${member.id}" нет ни одной цели` });
    } else {
      const present = new Set(goals.map(g => g.arcStage));
      for (const stage of stages) {
        if (!present.has(stage)) {
          issues.push({
            severity: 'warning',
            scope: `${scope}/goals`,
            message: `цели "${member.id}" не покрывают ступень близости ${stage} из ${stageCount} — лестница с пропуском: отношения прыгнут через ступень`,
          });
        }
      }
    }

    // Своё представление персонажа об идеале/худшем — не украшение: на нём
    // строится и тон поздних ступеней, и проза концовок. У каждого персонажа
    // оно СВОЁ (в этом смысл per-LI арки), поэтому пустое поле — дефект.
    if (member.isLI) {
      if (!member.agenda.idealRelationship?.trim()) {
        issues.push({
          severity: 'warning',
          scope: `${scope}/idealRelationship`,
          message: `у "${member.id}" не описано, какие отношения он считает идеальными — концовки и поздние ступени останутся обезличенными`,
        });
      }
      if (!member.agenda.worstRelationship?.trim()) {
        issues.push({
          severity: 'warning',
          scope: `${scope}/worstRelationship`,
          message: `у "${member.id}" не описано, какие отношения он считает худшими — плохая концовка останется обезличенной`,
        });
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
