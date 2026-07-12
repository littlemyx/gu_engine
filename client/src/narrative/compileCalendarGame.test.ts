import { describe, expect, it } from 'vitest';
import { compileCalendarGameProject, lintRouters, scheduleRuns } from './compileCalendarGame';
import { guardFromRequires } from './calendarTypes';
import type { Calendar, CharacterSchedule, SpineBeat, SpinePlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import { DEFAULT_LOCATION_MOOD, endingKey } from './types';
import type { Brief, DialogueVariant, EndingVariant, WorldLocation, WorldModel } from './types';
import type { GameSceneGraph, GameStateCondition } from './convertToGameProject';

const brief: Brief = SAMPLE_BRIEF;

/** 4 дня × 3 части = 12 слотов, по акту на день (fixture calendar.test.ts). */
const cal: Calendar = {
  days: 4,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 12,
  actBoundaries: [0, 1, 2, 3],
};

const loc = (id: string, adjacent: WorldLocation['adjacent']): WorldLocation => ({
  id,
  name: id,
  description: `описание ${id}`,
  pointsOfInterest: [],
  adjacent,
  mood: DEFAULT_LOCATION_MOOD,
  specialKind: null,
});

/** 3 связанные локации: a — b — c. */
const worldModel: WorldModel = {
  locations: [
    loc('loc_a', [{ locationId: 'loc_b', via: 'тропа' }]),
    loc('loc_b', [{ locationId: 'loc_c', via: 'мост' }]),
    loc('loc_c', []),
  ],
  anchorLocations: {},
};

const beat = (patch: Partial<SpineBeat> & Pick<SpineBeat, 'id'>): SpineBeat => ({
  kind: 'beat',
  act: 1,
  window: { fromSlot: 0, toSlot: 2 },
  locationId: 'loc_a',
  participants: [],
  summary: 'что-то происходит',
  establishes: [],
  guard: { all: [] },
  ...patch,
});

/** 4 бита с финалом и одной флаговой зависимостью (b1 → b2). */
const spine: SpinePlan = {
  title: 'Тестовый хребет',
  logline: 'Интро истории.',
  beats: [
    beat({ id: 'b1', act: 1, window: { fromSlot: 0, toSlot: 2 }, locationId: 'loc_a', establishes: ['met_all'] }),
    beat({
      id: 'b2',
      act: 2,
      window: { fromSlot: 3, toSlot: 5 },
      locationId: 'loc_b',
      guard: guardFromRequires(['met_all']),
    }),
    beat({ id: 'b3', act: 3, window: { fromSlot: 6, toSlot: 8 }, locationId: 'loc_c' }),
    beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 }, locationId: 'loc_a' }),
  ],
  endings: [
    { id: 'e_good', kind: 'good', liId: 'kira', guard: guardFromRequires(['met_all']) },
    { id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } },
    { id: 'e_bad', kind: 'bad', liId: null, guard: { all: [] } },
  ],
};

/** Кира: слоты 0-2 в loc_a, 6-8 в loc_b → два диапазона встреч. */
const schedule: CharacterSchedule = {
  kira: ['loc_a', 'loc_a', 'loc_a', null, null, null, 'loc_b', 'loc_b', 'loc_b', null, null, null],
};

const dialogueVariant: DialogueVariant = {
  bracket: 'neutral',
  liId: 'kira',
  entrySceneId: 'd1',
  scenes: [
    {
      id: 'd1',
      location: '',
      timeMarker: '',
      charactersPresent: [],
      narration: 'Кира кивает.',
      dialogue: [],
      choices: [],
    },
  ],
};

const endingVariant = (kind: EndingVariant['kind'], liId: string | null): EndingVariant => ({
  kind,
  liId,
  scenes: [{ id: '', narration: `эпилог ${kind}` }],
});

const endings: Record<string, EndingVariant> = {
  [endingKey('good', 'kira')]: endingVariant('good', 'kira'),
  [endingKey('normal')]: endingVariant('normal', null),
  [endingKey('bad')]: endingVariant('bad', null),
};

const compile = (unitProse: Record<string, DialogueVariant[]> = {}) =>
  compileCalendarGameProject(brief, spine, cal, schedule, worldModel, {}, unitProse, endings);

const edgesFrom = (scenes: GameSceneGraph, source: string) => scenes.edges.filter(e => e.source === source);
const hasCond = (conds: GameStateCondition[] | undefined, c: GameStateCondition) =>
  (conds ?? []).some(x => x.path === c.path && x.gte === c.gte && x.lte === c.lte);

describe('compileCalendarGameProject', () => {
  it('slot-переменная в схеме: [0, slotCount], default 0', () => {
    const { project } = compile();
    expect(project.settings.stateSchema?.vars['slot']).toEqual({ range: [0, 12], default: 0 });
    expect(project.settings.calendar).toEqual({ slotCount: 12, dayparts: cal.dayparts, actBoundaries: [0, 1, 2, 3] });
  });

  it('каждый hub имеет «Подождать» (slot+1) с возвратом через enter той же локации', () => {
    const { scenes } = compile();
    for (const l of worldModel.locations) {
      const hub = scenes.nodes.find(n => n.id === `hub_${l.id}`)!;
      const wait = hub.data.outputs.find(o => o.text === 'Подождать');
      expect(wait, `hub_${l.id} без «Подождать»`).toBeTruthy();
      expect(wait!.effects?.stateDeltas).toEqual({ slot: 1 });
      const edge = scenes.edges.find(e => e.source === hub.id && e.sourceHandle === wait!.id)!;
      expect(edge.target).toBe(`enter_${l.id}`);
      expect(edge.condition).toBeUndefined();
    }
  });

  it('ребро бита в enter-роутере: окно слотов + flag-условия requires + одноразовость', () => {
    const { scenes } = compile();
    const edge = edgesFrom(scenes, 'enter_loc_b').find(e => e.target === 'b2')!;
    expect(edge).toBeTruthy();
    expect(hasCond(edge.condition, { path: 'slot', gte: 3 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'slot', lte: 5 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'flag[met_all]', gte: 1 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'beat[b2]', lte: 0 })).toBe(true);
  });

  it('выход бита ставит beat[id], establishes-флаги и двигает slot', () => {
    const { scenes } = compile();
    const b1 = scenes.nodes.find(n => n.id === 'b1')!;
    expect(b1.data.outputs).toHaveLength(1);
    expect(b1.data.outputs[0].effects?.stateDeltas).toEqual({ 'beat[b1]': 1, 'flag[met_all]': 1, slot: 1 });
    // Возврат в хаб своей локации.
    expect(edgesFrom(scenes, 'b1')[0].target).toBe('hub_loc_a');
  });

  it('финал уводит в ending_router; у good-концовки flag- и affection-условия', () => {
    const { scenes } = compile();
    expect(edgesFrom(scenes, 'fin')[0].target).toBe('ending_router');

    const routerEdges = edgesFrom(scenes, 'ending_router');
    expect(routerEdges.length).toBeGreaterThanOrEqual(3);
    const goodEdge = routerEdges[0];
    expect(hasCond(goodEdge.condition, { path: 'flag[met_all]', gte: 1 })).toBe(true);
    expect((goodEdge.condition ?? []).some(c => c.path === 'relationship[kira].affection' && c.gte != null)).toBe(true);
    // Безусловный normal — последним (страховка ROUTER_DEAD_END).
    expect(routerEdges[routerEdges.length - 1].condition).toBeUndefined();
  });

  it('lintRouters: у каждого роутера последнее ребро безусловно', () => {
    const { scenes } = compile({ enc_kira: [dialogueVariant] });
    expect(lintRouters(scenes)).toEqual([]);
  });

  it('граф без висячих целей: каждое ребро ведёт в существующий узел', () => {
    const { scenes } = compile({ enc_kira: [dialogueVariant] });
    const ids = new Set(scenes.nodes.map(n => n.id));
    for (const e of scenes.edges) {
      expect(ids.has(e.target), `висячее ребро ${e.id} → ${e.target}`).toBe(true);
      expect(ids.has(e.source), `ребро ${e.id} из несуществующего ${e.source}`).toBe(true);
    }
  });

  it('расписание схлопывается в диапазоны, встречи гейтятся слотами и met', () => {
    expect(scheduleRuns(schedule, cal.slotCount)).toEqual([
      { liId: 'kira', locId: 'loc_a', fromSlot: 0, toSlot: 2 },
      { liId: 'kira', locId: 'loc_b', fromSlot: 6, toSlot: 8 },
    ]);

    const { scenes, project, stats } = compile({ enc_kira: [dialogueVariant] });
    expect(stats.encountersWired).toBe(2);

    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить с Кира')!;
    expect(meet).toBeTruthy();
    const meetEdge = scenes.edges.find(e => e.source === 'hub_loc_a' && e.sourceHandle === meet.id)!;
    expect(hasCond(meetEdge.condition, { path: 'slot', gte: 0 })).toBe(true);
    expect(hasCond(meetEdge.condition, { path: 'slot', lte: 2 })).toBe(true);
    expect(hasCond(meetEdge.condition, { path: 'met[kira].0', lte: 0 })).toBe(true);
    expect(project.settings.stateSchema?.vars['met[kira].0']).toEqual({ range: [0, 1], default: 0 });

    // Выход из диалога: met=1 и slot+1 (терминальная narration-сцена).
    const dlgScenes = scenes.nodes.filter(n => n.data.label === 'Кира кивает.');
    expect(dlgScenes.length).toBe(2); // по сцене на каждый диапазон
    const exitOut = dlgScenes[0].data.outputs[0];
    expect(exitOut.effects?.stateDeltas?.slot).toBe(1);
    expect(Object.keys(exitOut.effects?.stateDeltas ?? {}).some(k => k.startsWith('met[kira].'))).toBe(true);
  });

  it('без прозы встречи не проводятся (нет кнопки)', () => {
    const { scenes, stats } = compile({});
    expect(stats.encountersWired).toBe(0);
    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    expect(hubA.data.outputs.some(o => o.text.startsWith('Поговорить'))).toBe(false);
  });

  it('stats: слоты и проведённые биты', () => {
    const { stats } = compile();
    expect(stats.slotCount).toBe(12);
    expect(stats.beatsWired).toBe(4);
    expect(stats.events).toBe(4);
    expect(stats.locations).toBe(3);
  });
});
