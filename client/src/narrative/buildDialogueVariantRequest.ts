import type {
  AnchorBeat,
  BeatPlan,
  Brief,
  LoveInterestCard,
  ArchetypeProfile,
  StoryAnchor,
  StoryOutlinePlan,
  DialogueVariantBracket,
  Range,
  StateVarPath,
} from './types';
import { ARCHETYPES } from './archetypes';
import { encounterIndexFor } from './anchorOrder';

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

export type DialogueEncounterContext = {
  encounterIndex: number;
  totalPlannedEncounters: number;
  beatType?: string | null;
  beatPurpose?: string;
  goal?: string;
  liArcSummary?: string;
  priorEncounters: { anchorId: string; location: string; timeMarker: string; goal: string }[];
  anchorBeatText?: string;
};

/**
 * Контекст арки для диалога: номер встречи по плану, целевой бит,
 * goals предыдущих встреч. Возвращает undefined, если плана нет или
 * встреча (anchor, li) в нём не значится.
 */
export function buildEncounterContext(
  plan: BeatPlan | null,
  outline: StoryOutlinePlan,
  anchorBeats: Record<string, AnchorBeat>,
  li: LoveInterestCard,
  anchor: StoryAnchor,
): DialogueEncounterContext | undefined {
  if (!plan) return undefined;
  const planned = plan.encounters.find(e => e.liId === li.id && e.anchorId === anchor.id);
  const { index, total, prior } = encounterIndexFor(plan, outline, li.id, anchor.id);
  if (total === 0) return undefined;

  const anchorById = new Map(outline.anchors.map(a => [a.id, a]));
  const beatPurpose = planned?.beatType
    ? ARCHETYPES[li.archetype].requiredBeats.find(b => b.type === planned.beatType)?.purpose
    : undefined;

  return {
    encounterIndex: index,
    totalPlannedEncounters: total,
    beatType: planned?.beatType ?? null,
    beatPurpose,
    goal: planned?.goal,
    liArcSummary: plan.liArcs.find(a => a.liId === li.id)?.arcSummary,
    priorEncounters: prior.map(p => {
      const a = anchorById.get(p.anchorId);
      const plannedPrior = plan.encounters.find(e => e.liId === li.id && e.anchorId === p.anchorId);
      return {
        anchorId: p.anchorId,
        location: a?.location ?? '',
        timeMarker: a?.timeMarker ?? '',
        goal: plannedPrior?.goal ?? '',
      };
    }),
    anchorBeatText: anchorBeats[anchor.id]?.beatText,
  };
}

export function buildDialogueVariantRequestPayload(
  brief: Brief,
  li: LoveInterestCard,
  anchor: StoryAnchor,
  bracket: DialogueVariantBracket,
  recentEvents: string,
  encounterContext?: DialogueEncounterContext,
  locationEntity?: { name: string; description: string; pointsOfInterest: string[] },
): {
  brief: Brief;
  liCard: LoveInterestCard;
  archetypeProfile: ArchetypeProfile;
  storyContext: { location: string; timeMarker: string; recentEvents: string };
  bracket: DialogueVariantBracket;
  stateRanges: Record<StateVarPath, Range>;
  encounterContext?: DialogueEncounterContext;
} {
  const archetypeProfile = ARCHETYPES[li.archetype];

  return {
    brief,
    liCard: li,
    archetypeProfile,
    storyContext: {
      // Сущность локации из модели мира стабильнее свободного текста якоря.
      location: locationEntity
        ? `${locationEntity.name}. ${locationEntity.description}${
            locationEntity.pointsOfInterest.length
              ? ` Ключевые точки: ${locationEntity.pointsOfInterest.join(', ')}.`
              : ''
          }`
        : anchor.location,
      timeMarker: anchor.timeMarker,
      recentEvents,
    },
    bracket,
    stateRanges: computeBracketRanges(bracket, archetypeProfile),
    ...(encounterContext ? { encounterContext } : {}),
  };
}
