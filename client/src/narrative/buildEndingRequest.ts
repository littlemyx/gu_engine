import type { AnchorBeat, BeatPlan, Brief, EndingKind, LoveInterestCard, StoryOutlinePlan } from './types';
import { ARCHETYPES } from './archetypes';
import { topoOrderAnchors } from './anchorOrder';

export type EndingRequestPayload = {
  brief: Brief;
  outline: { title: string; logline: string; acts: StoryOutlinePlan['acts']; resolutionAnchor?: unknown };
  kind: EndingKind;
  liCard?: LoveInterestCard;
  endingTone?: string;
  liArcSummary?: string;
  finalEncounterGoal?: string;
  resolutionBeatText?: string;
};

/** Общий тон normal/bad концовок без выделенного LI — из тона мира брифа. */
function sharedTone(kind: EndingKind, brief: Brief): string {
  if (kind === 'normal') {
    return `недосказанность с надеждой; настроение мира: ${brief.world.tone.mood}`;
  }
  return `тихое отчуждение, упущенные связи; настроение мира: ${brief.world.tone.mood}`;
}

export function buildEndingRequestPayload(
  brief: Brief,
  outline: StoryOutlinePlan,
  kind: EndingKind,
  li: LoveInterestCard | null,
  beatPlan: BeatPlan | null,
  anchorBeats: Record<string, AnchorBeat>,
): EndingRequestPayload {
  const resolution = outline.anchors.find(a => a.type === 'resolution');

  let endingTone: string;
  let liArcSummary: string | undefined;
  let finalEncounterGoal: string | undefined;

  if (kind === 'good' && li) {
    endingTone = ARCHETYPES[li.archetype].endingProfile.good.tone;
    liArcSummary = beatPlan?.liArcs.find(a => a.liId === li.id)?.arcSummary;
    if (beatPlan) {
      // Последняя запланированная встреча LI — в топологическом порядке якорей.
      const topoIndex = new Map(topoOrderAnchors(outline).map((a, i) => [a.id, i]));
      const liEncounters = beatPlan.encounters
        .filter(e => e.liId === li.id)
        .sort((a, b) => (topoIndex.get(a.anchorId) ?? 0) - (topoIndex.get(b.anchorId) ?? 0));
      finalEncounterGoal = liEncounters[liEncounters.length - 1]?.goal;
    }
  } else {
    endingTone = sharedTone(kind, brief);
  }

  return {
    brief,
    outline: {
      title: outline.title,
      logline: outline.logline,
      acts: outline.acts,
      resolutionAnchor: resolution,
    },
    kind,
    ...(kind === 'good' && li ? { liCard: li } : {}),
    endingTone,
    liArcSummary,
    finalEncounterGoal,
    resolutionBeatText: resolution ? anchorBeats[resolution.id]?.beatText : undefined,
  };
}
