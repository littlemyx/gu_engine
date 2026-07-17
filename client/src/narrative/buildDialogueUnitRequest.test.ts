import { describe, expect, it } from 'vitest';
import type { Calendar, CharacterSchedule, EventUnit } from './calendarTypes';
import type { LoveInterestCard, WorldModel } from './types';
import { DEFAULT_LOCATION_MOOD } from './types';
import { SAMPLE_BRIEF } from './sampleBrief';
import { buildDialogueUnitRequestPayload } from './buildDialogueUnitRequest';

const cal: Calendar = { days: 4, dayparts: ['утро', 'день', 'вечер'], slotCount: 12, actBoundaries: [0, 1, 2, 3] };

const worldModel: WorldModel = {
  locations: [
    {
      id: 'cafe',
      name: 'Кафе',
      description: 'тихое кафе',
      pointsOfInterest: [],
      adjacent: [],
      mood: DEFAULT_LOCATION_MOOD,
      specialKind: null,
    },
  ],
  anchorLocations: {},
};

const schedule: CharacterSchedule = { yuki: new Array<string | null>(12).fill('cafe') };

/** Юки из сэмпл-брифа — с ней preExistingRelationship = null (незнакомка). */
const yuki = SAMPLE_BRIEF.loveInterests.find(li => li.preExistingRelationship == null)!;
/** LI, с которым герои уже шапочно знакомы. */
const known = SAMPLE_BRIEF.loveInterests.find(li => li.preExistingRelationship != null)!;

const unit = (id: string, fromSlot: number, arcStage = 1, liId = yuki.id): EventUnit =>
  ({
    id,
    kind: 'dialogue',
    at: { slot: { fromSlot, toSlot: fromSlot + 1 }, locationId: 'cafe' },
    participants: [liId],
    guard: { all: [] },
    effects: [],
    priority: 20,
    goal: 'поболтать',
    arcStage,
    source: 'agenda',
  } as EventUnit);

const payload = (li: LoveInterestCard, target: EventUnit | null, liUnits: EventUnit[] = []) =>
  buildDialogueUnitRequestPayload(SAMPLE_BRIEF, li, 'positive', cal, schedule, worldModel, null, target, liUnits);

describe('buildDialogueUnitRequestPayload: encounterContext', () => {
  it('первая встреча незнакомки → index 0 и preExistingRelationship null (промпт напишет знакомство)', () => {
    const first = unit('u1', 0);
    const ctx = payload(yuki, first, [first, unit('u2', 6, 2)]).encounterContext;
    expect(ctx).toMatchObject({ encounterIndex: 0, totalPlannedEncounters: 2, preExistingRelationship: null });
  });

  it('поздняя встреча → ненулевой индекс', () => {
    const first = unit('u1', 0);
    const second = unit('u2', 6, 2);
    expect(payload(yuki, second, [first, second]).encounterContext?.encounterIndex).toBe(1);
  });

  it('порядок встреч — по (arcStage, слот), а не по порядку в массиве', () => {
    const late = unit('u_late', 6, 2);
    const early = unit('u_early', 0, 1);
    const ctx = payload(yuki, early, [late, early]).encounterContext;
    expect(ctx?.encounterIndex).toBe(0);
  });

  it('уже знакомы → индекс 0, но preExistingRelationship задан (тон не «знакомство»)', () => {
    const first = unit('u1', 0, 1, known.id);
    const ctx = payload(known, first, [first]).encounterContext;
    expect(ctx?.encounterIndex).toBe(0);
    expect(ctx?.preExistingRelationship).toBe(known.preExistingRelationship);
  });

  it('без юнитов контекста нет — легаси-вызовы не ломаются', () => {
    expect(payload(yuki, null).encounterContext).toBeUndefined();
    expect(payload(yuki, unit('u1', 0), []).encounterContext).toBeUndefined();
  });

  it('юнит вне списка своего LI контекста не даёт', () => {
    expect(payload(yuki, unit('u_orphan', 3), [unit('u1', 0)]).encounterContext).toBeUndefined();
  });
});
