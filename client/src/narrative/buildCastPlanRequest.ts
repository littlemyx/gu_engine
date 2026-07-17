import type { ArchetypeId, ArchetypeProfile, Brief } from './types';
import { ARCHETYPES } from './archetypes';
import { arcStageCount, computeCalendarTargets } from './calendarTypes';

/**
 * Собирает payload для /generate/castPlan (стадия A1):
 *   - бриф как-есть
 *   - только профили архетипов, использованных LI брифа
 *     (тот же trimming-паттерн, что buildOutlineRequestPayload).
 *   - targets.arcStageCount — высота лестницы близости от длины истории.
 *
 * Число ступеней считается из brief.scale (та же функция, что даёт размер
 * календаря), потому что castPlan идёт ДО стадии календаря: своего календаря
 * на этот момент ещё нет, а бриф уже есть, и обе стадии целятся в одни цифры.
 */
export function buildCastPlanRequestPayload(brief: Brief): {
  brief: Brief;
  archetypeProfiles: Record<ArchetypeId, ArchetypeProfile>;
  targets: { arcStageCount: number };
} {
  const usedIds = new Set<ArchetypeId>(brief.loveInterests.map(li => li.archetype));
  const archetypeProfiles = {} as Record<ArchetypeId, ArchetypeProfile>;
  for (const id of usedIds) {
    archetypeProfiles[id] = ARCHETYPES[id];
  }
  const { days } = computeCalendarTargets(brief.scale.targetDurationMinutes);
  return { brief, archetypeProfiles, targets: { arcStageCount: arcStageCount(days) } };
}
