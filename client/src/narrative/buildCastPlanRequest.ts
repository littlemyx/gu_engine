import type { ArchetypeId, ArchetypeProfile, Brief } from './types';
import { ARCHETYPES } from './archetypes';

/**
 * Собирает payload для /generate/castPlan (стадия A1):
 *   - бриф как-есть
 *   - только профили архетипов, использованных LI брифа
 *     (тот же trimming-паттерн, что buildOutlineRequestPayload).
 */
export function buildCastPlanRequestPayload(brief: Brief): {
  brief: Brief;
  archetypeProfiles: Record<ArchetypeId, ArchetypeProfile>;
} {
  const usedIds = new Set<ArchetypeId>(brief.loveInterests.map(li => li.archetype));
  const archetypeProfiles = {} as Record<ArchetypeId, ArchetypeProfile>;
  for (const id of usedIds) {
    archetypeProfiles[id] = ARCHETYPES[id];
  }
  return { brief, archetypeProfiles };
}
