import { describe, expect, it } from 'vitest';
import { buildSchedule, validateSchedule } from './buildSchedule';
import { assignBeatSlots } from './beatSchedule';
import { buildStubCastPlan } from './castPlanStub';
import { guardFromRequires } from './calendarTypes';
import type { Calendar, SpineBeat, SpinePlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { Brief } from './types';

const brief: Brief = SAMPLE_BRIEF; // LI: kira, yuki, asel; 4 акта

/** 4 дня × 3 части = 12 слотов, по акту на день. */
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
  locationId: 'loc_beat',
  participants: [],
  summary: 'событие',
  establishes: [],
  guard: { all: [] },
  ...patch,
});

const spine: SpinePlan = {
  title: 'Тест',
  logline: 'Интро.',
  beats: [
    beat({ id: 'b1', participants: ['kira'], establishes: ['met_all'] }),
    beat({
      id: 'b2',
      act: 2,
      window: { fromSlot: 3, toSlot: 5 },
      participants: ['yuki'],
      guard: guardFromRequires(['met_all']),
    }),
    beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 }, participants: ['kira', 'yuki'] }),
  ],
  endings: [{ id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } }],
};

/** Теги стаб-агенд (workplace/hangout/home) → 4 локации. */
const tagMap: Record<string, string[]> = {
  workplace: ['loc_work_a', 'loc_work_b'],
  hangout: ['loc_hangout'],
  home: ['loc_home'],
};

const castPlan = buildStubCastPlan(brief);

const build = (seed = 0) => buildSchedule(brief, spine, cal, castPlan, tagMap, seed);

describe('buildSchedule', () => {
  it('пины битов побеждают weekly-паттерн', () => {
    const schedule = build();
    const beatSlots = assignBeatSlots(spine, cal);
    expect(schedule.kira[beatSlots.b1]).toBe('loc_beat');
    expect(schedule.yuki[beatSlots.b2]).toBe('loc_beat');
    expect(schedule.kira[beatSlots.fin]).toBe('loc_beat');
    expect(schedule.yuki[beatSlots.fin]).toBe('loc_beat');
  });

  it('детерминизм: одинаковый seed → одно расписание, другой seed → другое', () => {
    expect(build(7)).toEqual(build(7));
    const a = JSON.stringify(build(0));
    // Хоть один из соседних seed обязан дать другую раскладку.
    const differs = [1, 2, 3, 4, 5].some(s => JSON.stringify(build(s)) !== a);
    expect(differs).toBe(true);
  });

  it('инвариант покрытия: каждый слот держит ≥2 занятых локации', () => {
    const schedule = build();
    const errors = validateSchedule(schedule, spine, cal, brief).filter(i => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('локации назначений — только из tagMap или локаций битов', () => {
    const schedule = build();
    const allowed = new Set([...Object.values(tagMap).flat(), 'loc_beat']);
    for (const slots of Object.values(schedule)) {
      for (const loc of slots) {
        if (loc) expect(allowed.has(loc), `неизвестная локация ${loc}`).toBe(true);
      }
    }
  });

  it('пол присутствия: каждый LI на сцене ≥ ceil(слотов_акта/3) в каждом акте', () => {
    const schedule = build();
    const warnings = validateSchedule(schedule, spine, cal, brief).filter(i => i.scope.startsWith('coverage/'));
    expect(warnings).toEqual([]);
  });
});

describe('validateSchedule', () => {
  it('ловит сломанный пин участника бита', () => {
    const schedule = build();
    const beatSlots = assignBeatSlots(spine, cal);
    schedule.kira[beatSlots.b1] = 'loc_hangout'; // сорвали пин
    const issues = validateSchedule(schedule, spine, cal, brief);
    expect(issues.some(i => i.severity === 'error' && i.scope === 'beats/b1')).toBe(true);
  });

  it('ловит слот, где все в одной локации', () => {
    const schedule = build();
    // Слот 1: всех — в одну локацию (бит на слоте 1? b2 назначается позже).
    for (const liId of Object.keys(schedule)) schedule[liId][1] = 'loc_hangout';
    const issues = validateSchedule(schedule, spine, cal, brief);
    expect(issues.some(i => i.severity === 'error' && i.scope === 'slots/1')).toBe(true);
  });

  it('ловит LI ниже пола присутствия в акте (warning)', () => {
    const schedule = build();
    // Акт 2 = слоты 3..5: убираем aselь со сцены полностью.
    for (let s = 3; s <= 5; s++) schedule.asel[s] = null;
    const issues = validateSchedule(schedule, spine, cal, brief);
    expect(issues.some(i => i.severity === 'warning' && i.scope === 'coverage/asel')).toBe(true);
  });
});
