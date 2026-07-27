import { describe, expect, it } from 'vitest';

import { deriveScore } from './scoreModel';

import type { Calendar, CharacterSchedule, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit } from '@/narrative/dialogueUnit';
import type { AnchorBeat, Brief, SegmentIssue, WorldModel } from '@/narrative/types';

const calendar: Calendar = {
  days: 2,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 6,
  // Границы актов заданы в ДНЯХ: второй акт начинается со второго дня.
  actBoundaries: [0, 1],
};

const brief = {
  loveInterests: [
    { id: 'kira', name: 'Кира' },
    { id: 'yuki', name: 'Юки' },
  ],
} as unknown as Brief;

const worldModel = {
  locations: [
    { id: 'loc_cafe', name: 'кафе Прибой', adjacent: [] },
    { id: 'loc_park', name: 'городской парк', adjacent: [] },
  ],
  anchorLocations: {},
} as unknown as WorldModel;

/** Кира: кафе весь день; Юки: парк, потом за кадром. */
const schedule: CharacterSchedule = {
  kira: ['loc_cafe', 'loc_cafe', 'loc_cafe', 'loc_cafe', 'loc_cafe', 'loc_cafe'],
  yuki: ['loc_park', 'loc_park', null, null, null, null],
} as unknown as CharacterSchedule;

const spine: SpinePlan = {
  title: 'Лето',
  logline: '—',
  beats: [
    {
      id: 'b1',
      kind: 'beat',
      act: 0,
      window: { fromSlot: 0, toSlot: 0 },
      locationId: 'loc_cafe',
      participants: ['kira'],
      summary: 'Знакомство',
      establishes: ['met_kira'],
      guard: { all: [] },
    },
    {
      id: 'b2',
      kind: 'beat',
      act: 1,
      window: { fromSlot: 4, toSlot: 5 },
      locationId: 'loc_cafe',
      participants: ['kira'],
      summary: 'Ссора',
      establishes: [],
      guard: { all: [{ flag: 'never_set' }] },
    },
  ],
  endings: [],
};

const unit = (id: string, charId: string, fromSlot: number, toSlot: number): EventUnit =>
  ({
    id,
    kind: 'dialogue',
    at: { slot: { fromSlot, toSlot }, locationId: 'loc_cafe' },
    participants: [charId],
    guard: { all: [] },
    effects: [],
    priority: 0,
    goal: 'поговорить',
    source: 'agenda',
  } as EventUnit);

const prose = (id: string): DialogueUnit[] =>
  [{ id, liId: 'kira', bracket: 'neutral', entryNodeId: 'n1', nodes: [] }] as unknown as DialogueUnit[];

const beatProse: Record<string, AnchorBeat> = {
  b1: { anchorId: 'b1', beatText: 'текст', transitions: [] },
};

const base = {
  brief,
  calendar,
  spine,
  schedule,
  worldModel,
  eventUnits: {},
  unitProse: {},
  spineBeatProse: {},
};

describe('deriveScore', () => {
  it('колонки идут по календарю, дни размечены по частям суток', () => {
    const model = deriveScore(base);

    expect(model.columns).toHaveLength(6);
    expect(model.columns[0]).toMatchObject({ day: 1, dayStart: true, short: 'утро' });
    expect(model.columns[3]).toMatchObject({ day: 2, dayStart: true });
    expect(model.acts.map(a => a.act)).toEqual([1, 2]);
  });

  it('клетка показывает код локации, а за кадром — прочерк', () => {
    const model = deriveScore(base);
    const yuki = model.rows.find(r => r.charId === 'yuki');

    expect(yuki?.cells[0].text).toBe('ГП');
    expect(yuki?.cells[0].state).toBe('loc');
    expect(yuki?.cells[2].state).toBe('offscreen');
    expect(model.locationCodes).toEqual([
      { code: 'КП', name: 'кафе Прибой' },
      { code: 'ГП', name: 'городской парк' },
    ]);
  });

  it('бит с прозой красит клетку в done, бит чужой ветки — в locked', () => {
    const model = deriveScore({ ...base, spineBeatProse: beatProse });
    const kira = model.rows.find(r => r.charId === 'kira');

    expect(kira?.cells[0].state).toBe('done');
    // b2 заперт флагом, который никто не ставит.
    expect(kira?.cells[4].state).toBe('locked');
  });

  it('несколько событий в клетке дают счётчик «КП+2»', () => {
    const model = deriveScore({
      ...base,
      spineBeatProse: beatProse,
      eventUnits: { u1: unit('u1', 'kira', 0, 0) },
    });

    expect(model.rows.find(r => r.charId === 'kira')?.cells[0].text).toBe('КП+2');
  });

  it('строка хребта нумерует биты и не зависит от расписания', () => {
    const model = deriveScore({ ...base, spineBeatProse: beatProse });

    expect(model.spine[0].text).toBe('Б1');
    expect(model.spine[0].state).toBe('done');
    expect(model.spine[1].state).toBe('empty');
  });

  it('покрытие: ● всё написано, ○ частично, ⚠ играть нечего', () => {
    const model = deriveScore({
      ...base,
      spineBeatProse: beatProse,
      eventUnits: { u1: unit('u1', 'kira', 1, 1) },
      unitProse: {},
    });

    expect(model.coverage[0].glyph).toBe('●');
    expect(model.coverage[1].glyph).toBe('○');
    expect(model.coverage[2].glyph).toBe('⚠');
  });

  it('юнит с прозой закрывает покрытие слота', () => {
    const model = deriveScore({
      ...base,
      eventUnits: { u1: unit('u1', 'kira', 1, 1) },
      unitProse: { u1: prose('u1') },
    });

    expect(model.coverage[1].glyph).toBe('●');
  });

  it('ошибка QA бьёт по клетке персонажа и по строке хребта', () => {
    const issues: SegmentIssue[] = [{ severity: 'error', scope: 'spine/beats/b1/window', message: 'окно вне акта' }];
    const model = deriveScore({ ...base, spineBeatProse: beatProse, issues });

    expect(model.rows.find(r => r.charId === 'kira')?.cells[0].state).toBe('failed');
    expect(model.spine[0].state).toBe('failed');
  });

  it('событие показывается только своим участникам', () => {
    const model = deriveScore({
      ...base,
      eventUnits: { u1: unit('u1', 'kira', 0, 0) },
    });

    expect(model.rows.find(r => r.charId === 'kira')?.cells[0].events).toHaveLength(2);
    // Юки в парке — событие кафе к ней не попадает.
    expect(model.rows.find(r => r.charId === 'yuki')?.cells[0].events).toHaveLength(0);
  });
});
