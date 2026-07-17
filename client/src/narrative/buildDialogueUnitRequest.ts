import type {
  ArchetypeProfile,
  Brief,
  DialogueVariantBracket,
  LoveInterestCard,
  Range,
  StateVarPath,
  WorldModel,
} from './types';
import type { CastAgenda, Calendar, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import { slotLabel, windowTimeMarker } from './calendarTypes';
import { ARCHETYPES } from './archetypes';
import { computeBracketRanges } from './buildDialogueVariantRequest';
import type { DialogueEncounterContext } from './buildDialogueVariantRequest';

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
  liUnits: EventUnit[] = [],
  agenda?: CastAgenda | null,
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
  // Маркер — по ВСЕМУ окну юнита, а не по его первому слоту: окно шире части
  // дня, и проза, знавшая только начало, здоровалась «Доброе утро» в вечерней
  // сцене (живой плейтест). Промпт обязан видеть, что время суток не одно.
  const unitWindow = unitGoal?.at.slot;
  const timeMarker = unitWindow
    ? windowTimeMarker(unitWindow, calendar)
    : firstSlot >= 0
    ? slotLabel(firstSlot, calendar)
    : '';

  // Цель юнита ведёт разговор; logline хребта — фолбэк-колорит.
  const recentEvents = unitGoal?.goal?.trim() ? `Цель встречи: ${unitGoal.goal.trim()}` : spine?.logline?.trim() || '';

  const encounterContext = buildEncounterContext(li, unitGoal, liUnits, agenda);

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
    ...(encounterContext ? { encounterContext } : {}),
  };
}

/**
 * Порядковый номер встречи в арке LI — статически, из окон юнитов.
 *
 * Зачем: все три брекета генерятся заранее, поэтому рантайм-affection модели
 * недоступен, и «positive» она писала как уже сложившуюся близость — отсюда
 * признание от незнакомки. Индекс встречи промпт уже умеет читать (rule 8):
 * первая встреча при preExistingRelationship = null — знакомство, без «как
 * обычно». Тон, а не гейт: порядок держит цепочка битов.
 */
function buildEncounterContext(
  li: LoveInterestCard,
  unitGoal: EventUnit | null | undefined,
  liUnits: EventUnit[],
  agenda?: CastAgenda | null,
): DialogueEncounterContext | undefined {
  if (!unitGoal || liUnits.length === 0) return undefined;
  const ordered = [...liUnits]
    .filter(u => u.kind === 'dialogue' && u.at.slot != null)
    .sort(
      (a, b) =>
        (a.arcStage ?? 1) - (b.arcStage ?? 1) ||
        a.at.slot!.fromSlot - b.at.slot!.fromSlot ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const index = ordered.findIndex(u => u.id === unitGoal.id);
  if (index < 0) return undefined;

  // Ступень лестницы и её ПЕРСОНАЛЬНЫЙ смысл: без них модель пишет «встречу
  // вообще» и в positive-брекете сползает в уже сложившуюся близость — отсюда
  // и брались признания от почти незнакомых.
  const stage = unitGoal.arcStage ?? 1;
  const stageCount = Math.max(...liUnits.map(u => u.arcStage ?? 1), 1);
  const stepMeaning = agenda?.goals?.find(g => g.arcStage === stage)?.description;

  return {
    encounterIndex: index,
    totalPlannedEncounters: ordered.length,
    goal: unitGoal.goal,
    priorEncounters: [],
    preExistingRelationship: li.preExistingRelationship,
    stageIndex: stage,
    stageCount,
    ...(stepMeaning ? { stepMeaning } : {}),
    ...(agenda?.idealRelationship ? { idealRelationship: agenda.idealRelationship } : {}),
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
