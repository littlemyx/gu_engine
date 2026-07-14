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

/** Финал — конвергентная сходка: participants обязаны накрывать всех LI брифа. */
const allLiIds = (): string[] => brief.loveInterests.map(li => li.id);

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
    beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 }, participants: allLiIds() }),
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

  it('ловит пережатые окна: двум co-play битам не хватает слотов', () => {
    const spine = okSpine();
    spine.beats[0].window = { fromSlot: 1, toSlot: 1 };
    spine.beats.splice(1, 0, beat({ id: 'b1b', act: 1, window: { fromSlot: 1, toSlot: 1 } }));
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('не удаётся расположить'))).toBe(true);
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

  it('финал с requires → error: финал должен быть безусловным', () => {
    const spine = okSpine();
    spine.beats[3].guard = guardFromRequires(['met_all']);
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.scope === 'beats/fin/requires' && i.message.includes('безусловным'))).toBe(true);
  });

  it('финал без части LI в participants → error: конвергентная сходка', () => {
    const spine = okSpine();
    spine.beats[3].participants = ['kira'];
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.scope === 'beats/fin/participants' && i.message.includes('yuki'))).toBe(true);
  });
});

describe('validateSpine: feasibility листьев веток', () => {
  /**
   * 1 развилка × 2 исхода (акт 2), по ветвовому биту акта 3 на исход,
   * концовки гейтятся флагами веток (+ безусловный fallback bad).
   */
  const branchedSpine = (): SpinePlan => ({
    title: 't',
    logline: 'l',
    beats: [
      beat({ id: 'b1', act: 1, window: { fromSlot: 0, toSlot: 2 }, establishes: ['met_all'] }),
      beat({
        id: 'bp',
        kind: 'branchPoint',
        act: 2,
        window: { fromSlot: 3, toSlot: 5 },
        guard: guardFromRequires(['met_all']),
        outcomes: [
          { id: 'cover', label: 'Скрыть', setsFlag: 'chose_cover', summary: 'ложь растёт' },
          { id: 'truth', label: 'Рассказать', setsFlag: 'chose_truth', summary: 'честный путь' },
        ],
      }),
      beat({
        id: 'br_cover',
        act: 3,
        window: { fromSlot: 6, toSlot: 8 },
        guard: guardFromRequires(['chose_cover']),
        establishes: ['lie_strained'],
      }),
      beat({
        id: 'br_truth',
        act: 3,
        window: { fromSlot: 6, toSlot: 8 },
        guard: guardFromRequires(['chose_truth']),
        establishes: ['club_reborn'],
      }),
      beat({
        id: 'fin',
        kind: 'finale',
        act: 4,
        window: { fromSlot: 9, toSlot: 11 },
        establishes: ['story_resolved'],
        participants: allLiIds(),
      }),
    ],
    endings: [
      { id: 'e_good', kind: 'good', liId: 'kira', guard: guardFromRequires(['story_resolved', 'club_reborn']) },
      { id: 'e_normal', kind: 'normal', liId: null, guard: guardFromRequires(['story_resolved', 'lie_strained']) },
      { id: 'e_bad', kind: 'bad', liId: null, guard: { all: [] } },
    ],
  });

  it('валидные ветки: каждый лист достигает финала и концовки — без ошибок', () => {
    expect(errors(validateSpine(branchedSpine(), cal, brief, null))).toEqual([]);
  });

  it('лист без выполнимой концовки → error с адресом листа', () => {
    const spine = branchedSpine();
    // Все концовки требуют цепочку ветки cover — у листа truth ни одной.
    spine.endings = [
      { id: 'e_good', kind: 'good', liId: 'kira', guard: guardFromRequires(['lie_strained']) },
      { id: 'e_normal', kind: 'normal', liId: null, guard: guardFromRequires(['chose_cover']) },
    ];
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('не имеет достижимой концовки') && i.message.includes('bp=truth'))).toBe(
      true,
    );
    // Лист cover при этом жив — ошибка ровно одна.
    expect(issues.filter(i => i.message.includes('не имеет достижимой концовки'))).toHaveLength(1);
  });

  it('финал, запертый флагом одной ветки → error недостижимости на другом листе', () => {
    const spine = branchedSpine();
    spine.beats[4].guard = guardFromRequires(['chose_cover']);
    const issues = errors(validateSpine(spine, cal, brief, null));
    expect(issues.some(i => i.message.includes('не достигает финала') && i.message.includes('bp=truth'))).toBe(true);
    expect(issues.some(i => i.message.includes('не достигает финала') && i.message.includes('bp=cover'))).toBe(false);
  });

  it('ветвовой бит, недостижимый на каждом листе → warning о мёртвом контенте', () => {
    const spine = branchedSpine();
    // Требует флаги ОБОИХ исходов одной развилки — невозможно ни на одном листе.
    spine.beats.splice(
      4,
      0,
      beat({
        id: 'impossible',
        act: 3,
        window: { fromSlot: 6, toSlot: 8 },
        guard: guardFromRequires(['chose_cover', 'chose_truth']),
      }),
    );
    const issues = validateSpine(spine, cal, brief, null);
    expect(issues.some(i => i.severity === 'warning' && i.scope === 'beats/impossible/reachability')).toBe(true);
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

  it('ловит несвязный мир: локация-остров без пути от старта', () => {
    const mkLoc = (id: string, adjacent: { locationId: string; via: string }[]) => ({
      id,
      name: id,
      description: '',
      pointsOfInterest: [],
      adjacent,
      mood: 'neutral_calm' as const,
      specialKind: null,
    });
    // corridor↔hall связаны; family_home — остров без рёбер (реальный кейс E2E).
    const world = {
      locations: [
        mkLoc('corridor', [{ locationId: 'hall', via: 'дверь' }]),
        mkLoc('hall', [{ locationId: 'corridor', via: 'дверь' }]),
        mkLoc('family_home', []),
      ],
      anchorLocations: {},
    };
    const issues = errors(validateCalendar(cal, brief, world, null, null));
    expect(issues.some(i => i.scope === 'world/family_home/adjacent' && i.message.includes('не связана'))).toBe(true);

    // Добавили ребро — мир связен, ошибок связности нет.
    const fixed = {
      ...world,
      locations: [
        world.locations[0],
        world.locations[1],
        mkLoc('family_home', [{ locationId: 'corridor', via: 'улица' }]),
      ],
    };
    expect(errors(validateCalendar(cal, brief, fixed, null, null))).toEqual([]);
  });

  it('ловит adjacent-ссылку на несуществующую локацию', () => {
    const world = {
      locations: [
        {
          id: 'hall',
          name: 'hall',
          description: '',
          pointsOfInterest: [],
          adjacent: [{ locationId: 'ghost', via: 'дыра' }],
          mood: 'neutral_calm' as const,
          specialKind: null,
        },
      ],
      anchorLocations: {},
    };
    const issues = errors(validateCalendar(cal, brief, world, null, null));
    expect(issues.some(i => i.scope === 'world/hall/adjacent' && i.message.includes('несуществующего'))).toBe(true);
  });
});
