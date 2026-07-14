import { describe, expect, it } from 'vitest';
import { REL_DELTA_BOUND, guardFiredIds, parseEventPool, unitEstablishes, validateEventUnits } from './parseEventPool';
import { guardFlags } from './validateSpine';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { Brief } from './types';

const brief: Brief = SAMPLE_BRIEF;

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

const spine: SpinePlan = {
  title: 'Тест',
  logline: 'Интро.',
  beats: [beat({ id: 'b1', establishes: ['met_all'] })],
  endings: [{ id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } }],
};

/** Кира весь календарь в loc_a. */
const schedule: CharacterSchedule = { kira: new Array(12).fill('loc_a') };

const shell = (patch: Record<string, unknown>) => ({
  id: 'talk',
  arcStage: 1,
  goal: 'Разговориться.',
  locationId: 'loc_a',
  window: { fromSlot: 0, toSlot: 3 },
  requires: [],
  establishes: [],
  relEffects: [{ var: 'affection', delta: 0.1 }],
  ...patch,
});

const parse = (units: Record<string, unknown>[]) => parseEventPool(JSON.stringify({ units }), 'kira');

describe('parseEventPool', () => {
  it('строит EventUnit: префикс id, kind dialogue, at, scene, priority, source', () => {
    const [unit] = parse([shell({ establishes: ['knows_taste'] })]);
    expect(unit.id).toBe('evt_kira_talk');
    expect(unit.kind).toBe('dialogue');
    expect(unit.participants).toEqual(['kira']);
    expect(unit.at).toEqual({ slot: { fromSlot: 0, toSlot: 3 }, locationId: 'loc_a' });
    expect(unit.scene).toEqual({ kind: 'dialogue', anchorId: 'evt_kira_talk', liId: 'kira' });
    expect(unit.priority).toBe(20);
    expect(unit.source).toBe('agenda');
    expect(unit.goal).toBe('Разговориться.');
    expect(unitEstablishes(unit)).toEqual(['knows_taste']);
  });

  it('rel-эффекты клампятся в ±0.3, establishes → setFlag', () => {
    const [unit] = parse([shell({ relEffects: [{ var: 'trust', delta: 0.9 }], establishes: ['x'] })]);
    const rel = unit.effects.find(e => 'rel' in e);
    expect(rel && 'rel' in rel && rel.rel.delta).toBe(REL_DELTA_BOUND);
    expect(unit.effects.some(e => 'setFlag' in e && e.setFlag === 'x')).toBe(true);
  });

  it('fired-цепочка стадий строится автоматически: стадия N зависит от последнего юнита N-1', () => {
    const units = parse([
      shell({ id: 'u1', arcStage: 1 }),
      shell({ id: 'u2', arcStage: 1, window: { fromSlot: 2, toSlot: 5 } }),
      shell({ id: 'u3', arcStage: 2, window: { fromSlot: 4, toSlot: 7 } }),
      shell({ id: 'u4', arcStage: 3, window: { fromSlot: 8, toSlot: 11 } }),
    ]);
    expect(guardFiredIds(units[0].guard)).toEqual([]);
    expect(guardFiredIds(units[2].guard)).toEqual(['evt_kira_u2']); // последний стадии 1
    expect(guardFiredIds(units[3].guard)).toEqual(['evt_kira_u3']);
  });

  it('requires уходят в guard как флаги', () => {
    const [unit] = parse([shell({ requires: ['met_all'] })]);
    expect(guardFlags(unit.guard)).toEqual(['met_all']);
  });
});

describe('validateEventUnits', () => {
  const validate = (units: EventUnit[]) => validateEventUnits(units, brief, cal, spine, schedule);
  const errorsOf = (units: EventUnit[]) => validate(units).filter(i => i.severity === 'error');

  const pool4 = () =>
    parse([
      shell({ id: 'u1', arcStage: 1 }),
      shell({ id: 'u2', arcStage: 1, window: { fromSlot: 2, toSlot: 5 } }),
      shell({ id: 'u3', arcStage: 2, window: { fromSlot: 4, toSlot: 7 } }),
      shell({ id: 'u4', arcStage: 3, window: { fromSlot: 8, toSlot: 11 } }),
    ]);

  it('валидный пул проходит без ошибок и warning-ов', () => {
    expect(validate(pool4())).toEqual([]);
  });

  it('окно вне календаря — error', () => {
    const units = parse([shell({ window: { fromSlot: 10, toSlot: 14 } })]);
    expect(errorsOf(units).some(i => i.message.includes('выходит за календарь'))).toBe(true);
  });

  it('локация, где персонажа не бывает в окне — error', () => {
    const units = parse([shell({ locationId: 'loc_ghost' })]);
    expect(errorsOf(units).some(i => i.message.includes('не бывает'))).toBe(true);
  });

  it('неизвестный requires-флаг — error; флаг хребта и флаг другого юнита — известны', () => {
    const bad = parse([shell({ requires: ['ghost_flag'] })]);
    expect(errorsOf(bad).some(i => i.message.includes('"ghost_flag"'))).toBe(true);

    const good = parse([
      shell({ id: 'u1', establishes: ['unit_flag'] }),
      shell({ id: 'u2', requires: ['met_all', 'unit_flag'], window: { fromSlot: 2, toSlot: 5 } }),
    ]);
    expect(errorsOf(good).filter(i => i.message.includes('требует флаг'))).toEqual([]);
  });

  it('rel-дельта вне границ — error (на юните, собранном вручную)', () => {
    const [unit] = pool4();
    const broken: EventUnit = {
      ...unit,
      effects: [{ rel: { char: 'kira', var: 'affection', delta: 0.5 } }],
    };
    expect(errorsOf([broken]).some(i => i.message.includes('вне границ'))).toBe(true);
  });

  it('меньше 4 юнитов на персонажа — warning', () => {
    const units = parse([shell({})]);
    expect(validate(units).some(i => i.severity === 'warning' && i.scope === 'coverage/kira')).toBe(true);
  });
});
