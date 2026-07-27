import { describe, expect, it } from 'vitest';

import { deriveRelations } from './relationsModel';

import type { Calendar, CharacterSchedule, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit } from '@/narrative/dialogueUnit';
import type { Brief, DialogueVariantBracket } from '@/narrative/types';

const calendar: Calendar = {
  days: 7,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 21,
  actBoundaries: [0, 7, 14],
};

const brief = (...names: string[]): Brief =>
  ({
    loveInterests: names.map(name => ({ id: name.toLowerCase(), name })),
  } as unknown as Brief);

const spine: SpinePlan = {
  title: 'Тест',
  logline: '—',
  beats: [
    {
      id: 'b1',
      kind: 'beat',
      act: 0,
      window: { fromSlot: 5, toSlot: 5 },
      locationId: 'cafe',
      participants: ['мия'],
      summary: 'Якорь',
      establishes: [],
      guard: { all: [] },
    },
  ],
  endings: [],
};

const unit = (id: string, charId: string, from: number, to: number, locationId: string): EventUnit =>
  ({
    id,
    kind: 'dialogue',
    at: { slot: { fromSlot: from, toSlot: to }, locationId },
    participants: [charId],
    guard: { all: [] },
    effects: [],
    priority: 0,
    goal: '',
    source: 'agenda',
  } as unknown as EventUnit);

const prose = (brackets: DialogueVariantBracket[]): DialogueUnit[] =>
  brackets.map(
    bracket => ({ id: `d-${bracket}`, liId: 'мия', bracket, entryNodeId: 'n1', nodes: [] } as unknown as DialogueUnit),
  );

describe('deriveRelations', () => {
  const schedule: CharacterSchedule = {
    мия: Array.from({ length: 21 }, (_, slot) => (slot % 3 === 2 ? null : slot === 4 ? 'cafe' : 'dorm')),
  };

  it('слои клетки: якорный бит > встреча > присутствие > за кадром', () => {
    const model = deriveRelations({
      brief: brief('Мия'),
      calendar,
      spine,
      schedule,
      eventUnits: { u1: unit('u1', 'мия', 3, 6, 'cafe') },
      unitProse: {},
    });
    const cells = model.rows[0].cells;
    expect(cells[5]).toBe('anchor'); // слот якорного бита
    expect(cells[4]).toBe('meeting'); // окно юнита и расписание совпали в cafe
    expect(cells[3]).toBe('present'); // юнит есть, но персонаж в dorm
    expect(cells[2]).toBe('offscreen'); // вечер — вне расписания
  });

  it('семидневный календарь подписывается днями недели', () => {
    const model = deriveRelations({
      brief: brief('Мия'),
      calendar,
      spine,
      schedule,
      eventUnits: {},
      unitProse: {},
    });
    expect(model.days).toEqual(['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']);
    expect(model.slotNote).toBe('21 слотов = 7 дней × 3 фазы');
  });

  it('покрытие брекетов: 0 = bad с проблемой, 1 = warn, 2+ = ok', () => {
    const model = deriveRelations({
      brief: brief('Мия'),
      calendar,
      spine,
      schedule,
      eventUnits: {
        u1: unit('u1', 'мия', 0, 1, 'dorm'),
        u2: unit('u2', 'мия', 2, 3, 'dorm'),
      },
      unitProse: {
        u1: prose(['positive', 'neutral']),
        u2: prose(['positive', 'neutral']),
      },
    });
    const row = model.coverage[0];
    expect(row.warm).toEqual({ count: 2, level: 'ok' });
    expect(row.neutral).toEqual({ count: 2, level: 'ok' });
    expect(row.cold).toEqual({ count: 0, level: 'bad' });
    expect(model.problems).toHaveLength(1);
    expect(model.problems[0].liId).toBe('мия');
    expect(model.problems[0].bracket).toBe('negative');
    expect(model.problems[0].message).toContain('холодный брекет Мия недостижим');
  });
});
