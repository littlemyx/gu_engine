import type {
  ArchetypeProfile,
  Brief,
  DialogueVariantBracket,
  LoveInterestCard,
  Range,
  StateVarPath,
  WorldModel,
} from './types';
import type { Calendar, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import { slotLabel } from './calendarTypes';
import { ARCHETYPES } from './archetypes';
import { computeBracketRanges } from './buildDialogueVariantRequest';

/**
 * Payload стадии dialogueUnit (фаза 3 calendar-branching): те же контекстные
 * поля, что у dialogueVariant (реюз computeBracketRanges), но storyContext
 * приходит из календарного стека — локация и слот первой запланированной
 * встречи LI по расписанию. Это колорит для промпта, не жёсткая привязка:
 * юнит играется во всех слотах диапазона встречи.
 *
 * unitGoal (фаза 4): проза ключуется по EventUnit — контекст берётся из
 * самого юнита (goal + его локация + slotLabel(window.fromSlot)), а не из
 * первого слота расписания.
 */
export function buildDialogueUnitRequestPayload(
  brief: Brief,
  li: LoveInterestCard,
  bracket: DialogueVariantBracket,
  calendar: Calendar,
  schedule: CharacterSchedule,
  worldModel: WorldModel,
  spine?: SpinePlan | null,
  unitGoal?: EventUnit | null,
): {
  brief: Brief;
  liCard: LoveInterestCard;
  archetypeProfile: ArchetypeProfile;
  storyContext: { location: string; timeMarker: string; recentEvents: string };
  bracket: DialogueVariantBracket;
  stateRanges: Record<StateVarPath, Range>;
} {
  const archetypeProfile = ARCHETYPES[li.archetype];

  // Приоритет контекста: юнит (goal + его локация + начало окна), иначе
  // первый слот, где LI стоит в расписании → локация и «день N · часть дня».
  const slots = schedule[li.id] ?? [];
  const firstSlot = slots.findIndex(locId => locId != null);
  const locId = unitGoal?.at.locationId ?? (firstSlot >= 0 ? slots[firstSlot] : null);
  const loc = locId ? worldModel.locations.find(l => l.id === locId) : undefined;

  const location = loc
    ? `${loc.name}. ${loc.description}${
        loc.pointsOfInterest.length ? ` Ключевые точки: ${loc.pointsOfInterest.join(', ')}.` : ''
      }`
    : brief.world.setting.place;
  const contextSlot = unitGoal?.at.slot?.fromSlot ?? (firstSlot >= 0 ? firstSlot : -1);
  const timeMarker = contextSlot >= 0 ? slotLabel(contextSlot, calendar) : '';

  // Цель юнита ведёт разговор; logline хребта — фолбэк-колорит.
  const recentEvents = unitGoal?.goal?.trim() ? `Цель встречи: ${unitGoal.goal.trim()}` : spine?.logline?.trim() || '';

  return {
    brief,
    liCard: li,
    archetypeProfile,
    storyContext: {
      location,
      timeMarker,
      recentEvents,
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
