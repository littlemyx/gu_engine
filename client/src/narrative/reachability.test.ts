import { describe, expect, it } from 'vitest';
import { computeReachableUnits } from './reachability';
import { guardFromRequires } from './calendarTypes';
import type { Calendar, EventUnit, SlotWindow, SpineBeat, SpinePlan } from './calendarTypes';
import type { Guard } from './events';

const cal: Calendar = {
  days: 4,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 12,
  actBoundaries: [0, 1, 2, 3],
};

const beat = (patch: Partial<SpineBeat> & Pick<SpineBeat, 'id'>): SpineBeat => ({
  kind: 'beat',
  act: 1,
  window: { fromSlot: 0, toSlot: 2 },
  locationId: 'loc_a',
  participants: [],
  summary: 'событие',
  establishes: [],
  guard: { all: [] },
  ...patch,
});

/** b1 (слот 0) ставит met_all; late (окно 8-11, слот 8) ставит late_flag. */
const spine: SpinePlan = {
  title: 'Тест',
  logline: '',
  beats: [
    beat({ id: 'b1', establishes: ['met_all'] }),
    beat({ id: 'late', act: 4, window: { fromSlot: 8, toSlot: 11 }, establishes: ['late_flag'] }),
  ],
  endings: [],
};

const unit = (id: string, window: SlotWindow, guard: Guard, establishes: string[] = []): EventUnit => ({
  id,
  kind: 'dialogue',
  at: { slot: window, locationId: 'loc_a' },
  participants: ['kira'],
  guard,
  effects: establishes.map(f => ({ setFlag: f })),
  scene: { kind: 'dialogue', anchorId: id, liId: 'kira' },
  priority: 20,
  goal: 'цель',
  arcStage: 1,
  source: 'agenda',
});

describe('computeReachableUnits', () => {
  it('fired-цепочка достижима целиком, когда окна согласованы', () => {
    const units = [
      unit('u1', { fromSlot: 0, toSlot: 3 }, { all: [] }),
      unit('u2', { fromSlot: 2, toSlot: 6 }, { all: [{ fired: 'u1' }] }),
      unit('u3', { fromSlot: 5, toSlot: 11 }, { all: [{ fired: 'u2' }] }),
    ];
    expect(computeReachableUnits(spine, cal, units)).toEqual(new Set(['u1', 'u2', 'u3']));
  });

  it('юнит, требующий флаг, установимый только после его окна — исключён', () => {
    const units = [
      // late_flag ставится битом late не раньше слота 8, окно юнита кончается на 5.
      unit('early_needs_late', { fromSlot: 0, toSlot: 5 }, guardFromRequires(['late_flag'])),
      // А с окном до конца календаря — успевает.
      unit('late_ok', { fromSlot: 8, toSlot: 11 }, guardFromRequires(['late_flag'])),
    ];
    expect(computeReachableUnits(spine, cal, units)).toEqual(new Set(['late_ok']));
  });

  it('транзитивно недостижимая цепочка исключается вместе с головой', () => {
    const units = [
      // Голова требует несуществующий флаг → недостижима.
      unit('head', { fromSlot: 0, toSlot: 3 }, guardFromRequires(['ghost_flag'])),
      unit('mid', { fromSlot: 2, toSlot: 6 }, { all: [{ fired: 'head' }] }),
      unit('tail', { fromSlot: 5, toSlot: 11 }, { all: [{ fired: 'mid' }] }),
    ];
    expect(computeReachableUnits(spine, cal, units)).toEqual(new Set());
  });

  it('флаг, установленный достижимым юнитом, открывает следующий (фикспойнт)', () => {
    const units = [
      unit('opener', { fromSlot: 0, toSlot: 3 }, guardFromRequires(['met_all']), ['door_open']),
      unit('follower', { fromSlot: 2, toSlot: 6 }, guardFromRequires(['door_open'])),
    ];
    expect(computeReachableUnits(spine, cal, units)).toEqual(new Set(['opener', 'follower']));
  });

  it('fired-зависимость, стартующая позже конца окна зависимого — исключает', () => {
    const units = [
      unit('late_dep', { fromSlot: 6, toSlot: 11 }, { all: [] }),
      unit('early_user', { fromSlot: 0, toSlot: 4 }, { all: [{ fired: 'late_dep' }] }),
    ];
    expect(computeReachableUnits(spine, cal, units)).toEqual(new Set(['late_dep']));
  });
});
