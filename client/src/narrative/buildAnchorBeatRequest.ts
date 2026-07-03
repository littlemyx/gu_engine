import type { AnchorBeat, Brief, StoryAnchor, StoryOutlinePlan, WorldModel } from './types';
import { ancestorChain, directPredecessors, outgoingOf } from './anchorOrder';
import { locationRoute } from './worldRoutes';

/** Сколько последних сцен-предков показываем генератору beat-сцены. */
const PREDECESSOR_CONTEXT_LIMIT = 4;

/**
 * Собирает payload для /generate/anchorBeat.
 *
 * predecessorBeats — хвост цепочки предков в топо-порядке; для уже
 * сгенерированных предков подставляется их beatText (поэтому фаза
 * anchor_beats идёт последовательно в топологическом порядке).
 */
export function buildAnchorBeatRequestPayload(
  brief: Brief,
  outline: StoryOutlinePlan,
  anchor: StoryAnchor,
  anchorBeats: Record<string, AnchorBeat>,
  worldModel: WorldModel | null = null,
): {
  brief: Brief;
  anchor: StoryAnchor;
  actPurpose: string;
  predecessorBeats: { anchorId: string; summary: string; beatText?: string }[];
  outgoingTargets: { anchorId: string; summary: string; location: string; timeMarker: string }[];
  location?: { id: string; name: string; description: string; pointsOfInterest: string[] };
  arrivedVia?: string;
} {
  const actPurpose = outline.acts.find(a => a.act === anchor.act)?.purpose ?? '';

  const predecessorBeats = ancestorChain(outline, anchor.id)
    .slice(-PREDECESSOR_CONTEXT_LIMIT)
    .map(a => ({
      anchorId: a.id,
      summary: a.summary,
      beatText: anchorBeats[a.id]?.beatText,
    }));

  const byId = new Map(outline.anchors.map(a => [a.id, a]));
  const outgoingTargets = outgoingOf(outline, anchor.id)
    .map(id => byId.get(id))
    .filter((a): a is StoryAnchor => Boolean(a))
    .map(a => ({
      anchorId: a.id,
      summary: a.summary,
      location: a.location,
      timeMarker: a.timeMarker,
    }));

  // Локация якоря из модели мира + как игрок прибывает (via последнего
  // плеча маршрута от любого из предков).
  let location: { id: string; name: string; description: string; pointsOfInterest: string[] } | undefined;
  let arrivedVia: string | undefined;
  if (worldModel) {
    const locId = worldModel.anchorLocations[anchor.id];
    const loc = worldModel.locations.find(l => l.id === locId);
    if (loc) {
      location = {
        id: loc.id,
        name: loc.name,
        description: loc.description,
        pointsOfInterest: loc.pointsOfInterest,
      };
    }
    const pred = directPredecessors(outline, anchor.id)[0];
    if (pred) {
      const route = locationRoute(worldModel, pred, anchor.id);
      const lastLeg = route && route.length > 1 ? route[route.length - 1] : undefined;
      if (lastLeg?.via) arrivedVia = lastLeg.via;
    }
  }

  return {
    brief,
    anchor,
    actPurpose,
    predecessorBeats,
    outgoingTargets,
    ...(location ? { location } : {}),
    ...(arrivedVia ? { arrivedVia } : {}),
  };
}
