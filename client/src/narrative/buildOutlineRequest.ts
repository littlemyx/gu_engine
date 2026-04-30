import type { Brief, ArchetypeProfile, ArchetypeId } from './types';
import { ARCHETYPES } from './archetypes';

/**
 * Собирает payload для /generate/outline:
 *   - бриф (как-есть)
 *   - только те профили архетипов, что используются LI в брифе
 *
 * Не передаём всю библиотеку — экономит токены и фокусирует контекст LLM
 * на релевантных архетипах.
 */
export function buildOutlineRequestPayload(brief: Brief): {
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
