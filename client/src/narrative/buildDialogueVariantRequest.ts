import type {
  Brief,
  LoveInterestCard,
  ArchetypeProfile,
  StoryAnchor,
  DialogueVariantBracket,
  Range,
  StateVarPath,
} from './types';
import { ARCHETYPES } from './archetypes';

function computeBracketRanges(
  bracket: DialogueVariantBracket,
  archetype: ArchetypeProfile,
): Record<StateVarPath, Range> {
  const ranges: Record<StateVarPath, Range> = {};

  const affectionInit = archetype.initialState.affection ?? [0, 0.5];
  const trustInit = archetype.initialState.trust ?? [0, 0.5];
  const tensionInit = archetype.initialState.tension ?? [0, 0.5];

  switch (bracket) {
    case 'positive':
      ranges.affection = [Math.max(affectionInit[0], 0.3), 1.0];
      ranges.trust = [Math.max(trustInit[0], 0.3), 1.0];
      ranges.tension = [0, Math.min(tensionInit[1], 0.4)];
      break;
    case 'neutral':
      ranges.affection = [0, 0.3];
      ranges.trust = [0, 0.4];
      ranges.tension = [tensionInit[0], tensionInit[1]];
      break;
    case 'negative':
      ranges.affection = [0, Math.min(affectionInit[1], 0.1)];
      ranges.trust = [0, Math.min(trustInit[1], 0.2)];
      ranges.tension = [Math.max(tensionInit[0], 0.5), 1.0];
      break;
  }

  if (archetype.additionalStateVars) {
    for (const [key, decl] of Object.entries(archetype.additionalStateVars)) {
      ranges[key] = decl.range;
    }
  }

  return ranges;
}

export function buildDialogueVariantRequestPayload(
  brief: Brief,
  li: LoveInterestCard,
  anchor: StoryAnchor,
  bracket: DialogueVariantBracket,
  recentEvents: string,
): {
  brief: Brief;
  liCard: LoveInterestCard;
  archetypeProfile: ArchetypeProfile;
  storyContext: { location: string; timeMarker: string; recentEvents: string };
  bracket: DialogueVariantBracket;
  stateRanges: Record<StateVarPath, Range>;
} {
  const archetypeProfile = ARCHETYPES[li.archetype];

  return {
    brief,
    liCard: li,
    archetypeProfile,
    storyContext: {
      location: anchor.location,
      timeMarker: anchor.timeMarker,
      recentEvents,
    },
    bracket,
    stateRanges: computeBracketRanges(bracket, archetypeProfile),
  };
}
