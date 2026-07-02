import type { ArchetypeId, ArchetypeProfile, Brief, EncounterSlot, StoryOutlinePlan } from './types';
import { ARCHETYPES } from './archetypes';
import { outgoingOf, topoOrderAnchors } from './anchorOrder';

/**
 * Encounter-слоты: якоря с хотя бы одним исходящим ребром (у них есть
 * паутины, где встреча может произойти) и непустым availableLIs.
 * Resolution-якорь слотов не имеет.
 */
export function computeEncounterSlots(outline: StoryOutlinePlan): EncounterSlot[] {
  return topoOrderAnchors(outline)
    .filter(a => outgoingOf(outline, a.id).length > 0 && a.availableLIs.length > 0)
    .map(a => ({
      anchorId: a.id,
      act: a.act,
      location: a.location,
      liIds: [...a.availableLIs],
    }));
}

export function buildBeatPlanRequestPayload(
  brief: Brief,
  outline: StoryOutlinePlan,
): {
  brief: Brief;
  outline: StoryOutlinePlan;
  archetypeProfiles: Record<ArchetypeId, ArchetypeProfile>;
  encounterSlots: EncounterSlot[];
} {
  const usedIds = new Set<ArchetypeId>(brief.loveInterests.map(li => li.archetype));
  const archetypeProfiles = {} as Record<ArchetypeId, ArchetypeProfile>;
  for (const id of usedIds) {
    archetypeProfiles[id] = ARCHETYPES[id];
  }

  // Якоря — в топологическом порядке: планировщик читает их как сюжет.
  const sortedOutline: StoryOutlinePlan = {
    ...outline,
    anchors: topoOrderAnchors(outline),
  };

  return {
    brief,
    outline: sortedOutline,
    archetypeProfiles,
    encounterSlots: computeEncounterSlots(outline),
  };
}
