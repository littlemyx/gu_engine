import type { Brief, StoryAnchor, StoryOutlinePlan } from './types';

export function buildNarrationWebRequestPayload(
  brief: Brief,
  outline: StoryOutlinePlan,
  fromId: string,
  toId: string,
): {
  brief: Brief;
  storyAnchorFrom: StoryAnchor;
  storyAnchorTo: StoryAnchor;
  availableLIs: { liId: string; liName: string; roleInWorld: string }[];
  existingFlags: string[];
} {
  const anchorFrom = outline.anchors.find(a => a.id === fromId);
  const anchorTo = outline.anchors.find(a => a.id === toId);
  if (!anchorFrom) throw new Error(`anchorFrom not found: ${fromId}`);
  if (!anchorTo) throw new Error(`anchorTo not found: ${toId}`);

  const liIds = new Set(anchorFrom.availableLIs);
  const availableLIs = brief.loveInterests
    .filter(li => liIds.has(li.id))
    .map(li => ({ liId: li.id, liName: li.name, roleInWorld: li.roleInWorld }));

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
    storyAnchorFrom: anchorFrom,
    storyAnchorTo: anchorTo,
    availableLIs,
    existingFlags: [...ancestorFlags].sort(),
  };
}
