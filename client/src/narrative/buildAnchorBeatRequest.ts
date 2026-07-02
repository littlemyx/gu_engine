import type { AnchorBeat, Brief, StoryAnchor, StoryOutlinePlan } from './types';
import { ancestorChain, outgoingOf } from './anchorOrder';

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
): {
  brief: Brief;
  anchor: StoryAnchor;
  actPurpose: string;
  predecessorBeats: { anchorId: string; summary: string; beatText?: string }[];
  outgoingTargets: { anchorId: string; summary: string; location: string; timeMarker: string }[];
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

  return { brief, anchor, actPurpose, predecessorBeats, outgoingTargets };
}
