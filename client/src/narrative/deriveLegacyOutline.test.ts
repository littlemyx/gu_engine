import { describe, expect, it } from 'vitest';
import { deriveLegacyOutline } from './deriveLegacyOutline';
import { guardFromRequires } from './calendarTypes';
import type { Calendar, CharacterSchedule, SpineBeat, SpinePlan } from './calendarTypes';
import { validateStoryOutline } from './validateStoryOutline';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { Brief, WorldLocation, WorldModel } from './types';

/** Бриф с 4 актами и LI kira/yuki/asel (как SAMPLE_BRIEF). */
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

/**
 * Хребет на 6 битов через 4 акта: setup + флаговая зависимость b1→b3,
 * actGate в акте 3 и финал. Каждый LI покрыт ≥2 якорями: kira и yuki —
 * участием, asel добирает второй якорь расписанием (co-location на b4).
 */
const spine = (): SpinePlan => ({
  title: 'Тестовый хребет',
  logline: 'Логлайн',
  beats: [
    beat({ id: 'b1', act: 1, participants: ['kira', 'yuki'], establishes: ['met_all'], summary: 'Знакомство' }),
    beat({ id: 'b2', act: 1, locationId: 'loc_b', participants: ['asel'] }),
    beat({
      id: 'b3',
      act: 2,
      window: { fromSlot: 3, toSlot: 5 },
      participants: ['kira', '$closestLI'],
      guard: guardFromRequires(['met_all']),
    }),
    beat({ id: 'b4', act: 3, window: { fromSlot: 6, toSlot: 8 }, locationId: 'loc_b', participants: ['yuki'] }),
    beat({ id: 'b5', kind: 'actGate', act: 3, window: { fromSlot: 6, toSlot: 8 }, locationId: 'loc_c' }),
    beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 }, participants: ['kira'] }),
  ],
  endings: [
    { id: 'e_good', kind: 'good', liId: 'kira', guard: { all: [] } },
    { id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } },
    { id: 'e_bad', kind: 'bad', liId: null, guard: { all: [] } },
  ],
});

const loc = (id: string, name: string): WorldLocation => ({
  id,
  name,
  description: '',
  pointsOfInterest: [],
  adjacent: [],
  mood: 'neutral_calm',
  specialKind: null,
});

const world: WorldModel = {
  locations: [loc('loc_a', 'кафе у набережной'), loc('loc_b', 'библиотека'), loc('loc_c', 'кампусная аллея')],
  anchorLocations: {},
};

/** Расписание: asel по слоту 6 стоит в loc_b — совпадает с битом b4. */
const schedule = (): CharacterSchedule => {
  const empty = () => new Array<string | null>(cal.slotCount).fill(null);
  const asel = empty();
  asel[6] = 'loc_b';
  return { kira: empty(), yuki: empty(), asel };
};

const errors = (issues: { severity: string }[]) => issues.filter(i => i.severity === 'error');

describe('deriveLegacyOutline', () => {
  it('производный outline проходит validateStoryOutline без ошибок', () => {
    const derived = deriveLegacyOutline(spine(), cal, schedule(), brief, world);
    expect(errors(validateStoryOutline(derived.outline, brief))).toEqual([]);
  });

  it('ровно один setup без входящих и один resolution без исходящих', () => {
    const { outline } = deriveLegacyOutline(spine(), cal, schedule(), brief, world);
    const setups = outline.anchors.filter(a => a.type === 'setup');
    const resolutions = outline.anchors.filter(a => a.type === 'resolution');
    expect(setups.map(a => a.id)).toEqual(['b1']);
    expect(resolutions.map(a => a.id)).toEqual(['fin']);
    expect(outline.anchorEdges.some(e => e.to === 'b1')).toBe(false);
    expect(outline.anchorEdges.some(e => e.from === 'fin')).toBe(false);
    // climax — не-actGate бит с максимальным слотом в актах 3-4; actGate → location_enter.
    expect(outline.anchors.find(a => a.id === 'b4')?.type).toBe('climax');
    expect(outline.anchors.find(a => a.id === 'b5')?.type).toBe('location_enter');
  });

  it('флаговая зависимость establishes→requires порождает ребро b1→b3', () => {
    const { outline } = deriveLegacyOutline(spine(), cal, schedule(), brief, world);
    expect(outline.anchorEdges.some(e => e.from === 'b1' && e.to === 'b3')).toBe(true);
    // Рёбра не дублируются и не содержат петель.
    const keys = outline.anchorEdges.map(e => `${e.from}->${e.to}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(outline.anchorEdges.some(e => e.from === e.to)).toBe(false);
  });

  it('availableLIs = участники (без $-плейсхолдеров) ∪ co-location по расписанию', () => {
    const { outline } = deriveLegacyOutline(spine(), cal, schedule(), brief, world);
    const b4 = outline.anchors.find(a => a.id === 'b4');
    // yuki — участник бита, asel добавлена расписанием (слот 6, loc_b).
    expect(new Set(b4?.availableLIs)).toEqual(new Set(['yuki', 'asel']));
    const b3 = outline.anchors.find(a => a.id === 'b3');
    // "$closestLI" отброшен — только реальный id.
    expect(b3?.availableLIs).toEqual(['kira']);
  });

  it('anchorLocations маппит каждый якорь на ID локации, а anchor.location — имя', () => {
    const derived = deriveLegacyOutline(spine(), cal, schedule(), brief, world);
    for (const a of derived.outline.anchors) {
      expect(derived.anchorLocations[a.id]).toBeTruthy();
    }
    expect(derived.anchorLocations.b4).toBe('loc_b');
    expect(derived.outline.anchors.find(a => a.id === 'b4')?.location).toBe('библиотека');
    // timeMarker — человекочитаемая подпись слота.
    expect(derived.outline.anchors.find(a => a.id === 'b1')?.timeMarker).toBe('день 1 · утро');
  });

  it('acts покрывает 1..brief.scale.acts, title/logline берутся из хребта', () => {
    const { outline } = deriveLegacyOutline(spine(), cal, schedule(), brief, world);
    expect(outline.acts.map(a => a.act)).toEqual([1, 2, 3, 4]);
    expect(outline.title).toBe('Тестовый хребет');
    expect(outline.logline).toBe('Логлайн');
  });

  it('без worldModel локация якоря — fallback на id', () => {
    const { outline } = deriveLegacyOutline(spine(), cal, schedule(), brief, null);
    expect(outline.anchors.find(a => a.id === 'b1')?.location).toBe('loc_a');
  });
});
