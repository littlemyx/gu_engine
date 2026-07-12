import type {
  ArchetypeProfile,
  Brief,
  DialogueVariantBracket,
  LoveInterestCard,
  Range,
  StateVarPath,
  WorldModel,
} from './types';
import type { Calendar, CharacterSchedule, SpinePlan } from './calendarTypes';
import { slotLabel } from './calendarTypes';
import { ARCHETYPES } from './archetypes';
import { computeBracketRanges } from './buildDialogueVariantRequest';

/**
 * Payload стадии dialogueUnit (фаза 3 calendar-branching): те же контекстные
 * поля, что у dialogueVariant (реюз computeBracketRanges), но storyContext
 * приходит из календарного стека — локация и слот первой запланированной
 * встречи LI по расписанию. Это колорит для промпта, не жёсткая привязка:
 * юнит играется во всех слотах диапазона встречи.
 */
export function buildDialogueUnitRequestPayload(
  brief: Brief,
  li: LoveInterestCard,
  bracket: DialogueVariantBracket,
  calendar: Calendar,
  schedule: CharacterSchedule,
  worldModel: WorldModel,
  spine?: SpinePlan | null,
): {
  brief: Brief;
  liCard: LoveInterestCard;
  archetypeProfile: ArchetypeProfile;
  storyContext: { location: string; timeMarker: string; recentEvents: string };
  bracket: DialogueVariantBracket;
  stateRanges: Record<StateVarPath, Range>;
} {
  const archetypeProfile = ARCHETYPES[li.archetype];

  // Первый слот, где LI стоит в расписании → локация и «день N · часть дня».
  const slots = schedule[li.id] ?? [];
  const firstSlot = slots.findIndex(locId => locId != null);
  const locId = firstSlot >= 0 ? slots[firstSlot] : null;
  const loc = locId ? worldModel.locations.find(l => l.id === locId) : undefined;

  const location = loc
    ? `${loc.name}. ${loc.description}${
        loc.pointsOfInterest.length ? ` Ключевые точки: ${loc.pointsOfInterest.join(', ')}.` : ''
      }`
    : brief.world.setting.place;
  const timeMarker = firstSlot >= 0 ? slotLabel(firstSlot, calendar) : '';

  return {
    brief,
    liCard: li,
    archetypeProfile,
    storyContext: {
      location,
      timeMarker,
      recentEvents: spine?.logline?.trim() || '',
    },
    bracket,
    stateRanges: computeBracketRanges(bracket, archetypeProfile),
  };
}

/** Выжимка карточки LI для dialogueQA-критика. */
export function buildLiCardSummary(li: LoveInterestCard): string {
  const traits = li.personality?.traits?.join(', ') ?? '';
  return [
    `Имя: ${li.name} (${li.roleInWorld})`,
    traits ? `Характер: ${traits}` : '',
    li.speechPattern ? `Речевой стиль: ${li.speechPattern}` : '',
    `Архетип: ${li.archetype}`,
  ]
    .filter(Boolean)
    .join('\n');
}
