import { describe, expect, it } from 'vitest';
import {
  actOfSlot,
  actSlotWindow,
  computeCalendarTargets,
  dayOfSlot,
  daypartOfSlot,
  guardFromRequires,
  parseCalendar,
  parseSpinePlan,
  slotLabel,
  slotOf,
} from './calendarTypes';
import type { Calendar, SpineBeat, SpinePlan } from './calendarTypes';
import { validateSpine } from './validateSpine';
import { validateCalendar } from './validateCalendar';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { Brief, SegmentIssue } from './types';

/** Бриф с 4 актами и бюджетом развилок 2 (как SAMPLE_BRIEF). */
const brief: Brief = SAMPLE_BRIEF;

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
  locationId: 'loc_a',
  participants: [],
  summary: '',
  establishes: [],
  guard: { all: [] },
  ...patch,
});

/** Валидный минимальный хребет под cal: по биту в актах 1-3 + финал в 4. */
const okSpine = (): SpinePlan => ({
  title: 't',
  logline: 'l',
  beats: [
    beat({ id: 'b1', act: 1, window: { fromSlot: 0, toSlot: 2 }, establishes: ['met_all'] }),
    beat({ id: 'b2', act: 2, window: { fromSlot: 3, toSlot: 5 }, guard: guardFromRequires(['met_all']) }),
    beat({ id: 'b3', act: 3, window: { fromSlot: 6, toSlot: 8 } }),
    beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 } }),
  ],
  endings: [
    { id: 'e_good', kind: 'good', liId: 'kira', guard: { all: [] } },
    { id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } },
    { id: 'e_bad', kind: 'bad', liId: null, guard: { all: [] } },
  ],
});

const errors = (issues: SegmentIssue[]) => issues.filter(i => i.severity === 'error');

describe('calendar helpers', () => {
  it('computeCalendarTargets: 30 минут → 12 слотов (4 полных дня)', () => {
    const t = computeCalendarTargets(30);
    expect(t).toEqual({ slotCount: 12, days: 4, daypartsPerDay: 3 });
  });

  it('computeCalendarTargets клампит к [9, 36] и добивает до целых дней', () => {
    expect(computeCalendarTargets(3).slotCount).toBe(9);
    expect(computeCalendarTargets(500).slotCount).toBe(36);
  });

  it('slot ↔ (day, daypart) и подписи', () => {
    expect(slotOf(2, 1, 3)).toBe(7);
    expect(dayOfSlot(7, cal)).toBe(2);
    expect(daypartOfSlot(7, cal)).toBe('день');
    expect(slotLabel(7, cal)).toBe('день 3 · день');
  });

  it('actOfSlot и окна актов по границам дней', () => {
    expect(actOfSlot(0, cal)).toBe(1);
    expect(actOfSlot(3, cal)).toBe(2);
    expect(actOfSlot(11, cal)).toBe(4);
    expect(actSlotWindow(1, cal)).toEqual({ fromSlot: 0, toSlot: 2 });
    expect(actSlotWindow(4, cal)).toEqual({ fromSlot: 9, toSlot: 11 });
  });
});

describe('parseSpinePlan / parseCalendar', () => {
  it('парсит валидный хребет: requires → all[flag]-guard', () => {
    const spine = parseSpinePlan(
      JSON.stringify({
        title: 't',
        logline: 'l',
        beats: [
          {
            id: 'b1',
            kind: 'beat',
            act: 1,
            window: { fromSlot: 0, toSlot: 2 },
            locationId: 'loc_a',
            requires: ['met_all'],
            establishes: ['x'],
          },
        ],
        endings: [{ id: 'e1', kind: 'normal', requires: [] }],
      }),
    );
    expect(spine.beats[0].guard).toEqual({ all: [{ flag: 'met_all' }] });
    expect(spine.beats[0].establishes).toEqual(['x']);
    expect(spine.endings[0].liId).toBeNull();
  });

  it('отклоняет неизвестный kind бита и битое окно', () => {
    const base = { title: '', logline: '', endings: [] };
    expect(() =>
      parseSpinePlan(
        JSON.stringify({
          ...base,
          beats: [{ id: 'b', kind: 'wat', window: { fromSlot: 0, toSlot: 1 }, locationId: 'l' }],
        }),
      ),
    ).toThrow(/invalid kind/);
    expect(() =>
      parseSpinePlan(JSON.stringify({ ...base, beats: [{ id: 'b', kind: 'beat', locationId: 'l' }] })),
    ).toThrow(/window/);
  });

  it('parseCalendar требует actBoundaries с нуля', () => {
    expect(() => parseCalendar({ days: 4, dayparts: ['у', 'д', 'в'], actBoundaries: [1, 2] })).toThrow(/actBoundaries/);
    const parsed = parseCalendar({ days: 4, dayparts: ['у', 'д', 'в'], actBoundaries: [0, 2] });
    expect(parsed.slotCount).toBe(12);
  });
});

describe('validateSpine', () => {
  it('валидный хребет проходит без ошибок', () => {
    expect(errors(validateSpine(okSpine(), cal, brief, null))).toEqual([]);
  });

  it('ловит требуемый флаг, который никто не устанавливает', () => {
    const spine = okSpine();
    spine.beats[1].guard = guardFromRequires(['ghost_flag']);
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('ghost_flag'))).toBe(true);
  });

  it('ловит зависимость от бита, который начинается позже дедлайна требующего', () => {
    const spine = okSpine();
    // b1 (окно до слота 2) требует флаг, который ставит только финал (слоты 9-11).
    spine.beats[3].establishes = ['late_flag'];
    spine.beats[0].guard = guardFromRequires(['late_flag']);
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('начинается позже'))).toBe(true);
  });

  it('ловит пережатые окна: двум битам не хватает слотов', () => {
    const spine = okSpine();
    spine.beats[0].window = { fromSlot: 1, toSlot: 1 };
    spine.beats.splice(1, 0, beat({ id: 'b1b', act: 1, window: { fromSlot: 1, toSlot: 1 } }));
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('не хватает свободного слота'))).toBe(true);
  });

  it('ловит окно вне слотов своего акта', () => {
    const spine = okSpine();
    spine.beats[0].window = { fromSlot: 0, toSlot: 5 }; // акт 1 = слоты 0-2
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('выходит за слоты акта'))).toBe(true);
  });

  it('ловит превышение бюджета развилок и неверное число исходов', () => {
    const spine = okSpine();
    const bp = (id: string): SpineBeat =>
      beat({
        id,
        kind: 'branchPoint',
        act: 2,
        window: { fromSlot: 3, toSlot: 5 },
        outcomes: [
          { id: `${id}_a`, label: 'а', setsFlag: `${id}_a`, summary: '' },
          { id: `${id}_b`, label: 'б', setsFlag: `${id}_b`, summary: '' },
        ],
      });
    spine.beats.push(bp('bp1'), bp('bp2'), bp('bp3'));
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('бюджет'))).toBe(true);

    const spine2 = okSpine();
    spine2.beats.push(beat({ id: 'bp', kind: 'branchPoint', act: 2, window: { fromSlot: 3, toSlot: 5 } }));
    expect(errors(validateSpine(spine2, cal, brief, null)).some(i => i.message.includes('2-3 исхода'))).toBe(true);
  });

  it('good-концовка обязана ссылаться на существующего LI', () => {
    const spine = okSpine();
    spine.endings[0] = { id: 'e_good', kind: 'good', liId: 'nobody', guard: { all: [] } };
    expect(errors(validateSpine(spine, cal, brief, null)).some(i => i.scope === 'endings/e_good')).toBe(true);
  });
});

describe('validateCalendar', () => {
  it('валидный календарь проходит', () => {
    expect(errors(validateCalendar(cal, brief, null, null, null))).toEqual([]);
  });

  it('ловит несовпадение числа актов и немонотонные границы', () => {
    const bad: Calendar = { ...cal, actBoundaries: [0, 2, 1] };
    const issues = errors(validateCalendar(bad, brief, null, null, null));
    expect(issues.some(i => i.message.includes('actBoundaries.length'))).toBe(true);
    expect(issues.some(i => i.message.includes('строго возрастать'))).toBe(true);
  });

  it('ловит агендный тег без локаций', () => {
    const castPlan = {
      members: [
        {
          id: 'kira',
          isLI: true,
          agenda: {
            goals: [],
            weeklyPattern: { утро: [{ tag: 'workplace', weight: 1 }] },
            locationTags: { workplace: 'работа' },
          },
        },
      ],
    };
    const issues = errors(validateCalendar(cal, brief, null, {}, castPlan));
    expect(issues.some(i => i.scope === 'tagMap/workplace')).toBe(true);
  });
});
