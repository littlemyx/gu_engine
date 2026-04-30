import type { AnchorPlan, ArchetypeProfile, Brief, OutlinePlan } from './types';
import { ARCHETYPES } from './archetypes';

/**
 * Собирает payload для /generate/segment.
 *
 * archetypeProfile подбирается так:
 *   - если у anchorFrom или anchorTo задан характер-фокус, и этот характер
 *     есть в loveInterests брифа — берём профиль его архетипа
 *   - иначе (common-route segment) — null
 *
 * existingFlags вычисляется как объединение establishes всех якорей-предков
 * anchorFrom (вкл. сам anchorFrom). Это даёт LLM-у контекст «что уже произошло
 * по сюжету», чтобы избежать противоречий.
 */
export function buildSegmentRequestPayload(
  brief: Brief,
  outline: OutlinePlan,
  fromId: string,
  toId: string,
): {
  brief: Brief;
  archetypeProfile: ArchetypeProfile | null;
  anchorFrom: AnchorPlan;
  anchorTo: AnchorPlan;
  existingFlags: string[];
} {
  const anchorFrom = outline.anchors.find(a => a.id === fromId);
  const anchorTo = outline.anchors.find(a => a.id === toId);
  if (!anchorFrom) throw new Error(`anchorFrom not found: ${fromId}`);
  if (!anchorTo) throw new Error(`anchorTo not found: ${toId}`);

  // Предпочитаем focus у anchorTo (он определяет, в чей маршрут мы идём),
  // иначе focus у anchorFrom.
  const focusLiId = anchorTo.characterFocus ?? anchorFrom.characterFocus ?? null;
  const li = focusLiId ? brief.loveInterests.find(l => l.id === focusLiId) : null;
  const archetypeProfile = li ? ARCHETYPES[li.archetype] : null;

  // BFS назад по anchorEdges, собираем флаги предков.
  const ancestorFlags = new Set<string>();
  const queue: string[] = [fromId];
  const visited = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const a = outline.anchors.find(x => x.id === cur);
    if (a) for (const f of a.establishes) ancestorFlags.add(f);
    for (const e of outline.anchorEdges) {
      if (e.to === cur && !visited.has(e.from)) queue.push(e.from);
    }
  }

  return {
    brief,
    archetypeProfile,
    anchorFrom,
    anchorTo,
    existingFlags: [...ancestorFlags].sort(),
  };
}
