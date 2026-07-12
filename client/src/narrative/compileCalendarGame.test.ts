import { describe, expect, it } from 'vitest';
import { compileCalendarGameProject, lintRouters, scheduleRuns } from './compileCalendarGame';
import { guardFromRequires } from './calendarTypes';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import { DEFAULT_LOCATION_MOOD, endingKey } from './types';
import type { Brief, EndingVariant, WorldLocation, WorldModel } from './types';
import type { DialogueUnit } from './dialogueUnit';
import { validateDialogueUnit } from './dialogueUnit';
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

/**
 * DialogueUnit-фикстура (фаза 3): entry с ask/farewell, узел-ответ с
 * farewell и closing-узел с прощальной репликой Киры. Проходит
 * validateDialogueUnit (см. ассерт в сьюте).
 */
const dialogueUnit: DialogueUnit = {
  id: 'unit_kira_neutral',
  liId: 'kira',
  bracket: 'neutral',
  entryNodeId: 'd1',
  nodes: [
    {
      id: 'd1',
      charactersPresent: ['kira'],
      characterEmotions: { kira: 'idle' },
      narration: 'Кира кивает.',
      dialogue: [{ speaker: 'kira', emotion: 'idle', line: 'Привет.' }],
      choices: [
        {
          id: 'c_ask',
          kind: 'ask',
          text: 'Спросить, как прошёл день',
          next: 'd2',
          effects: { stateDeltas: {}, flagSet: [], flagClear: [] },
        },
        {
          id: 'c_bye',
          kind: 'farewell',
          text: 'Попрощаться',
          next: 'd3',
          effects: { stateDeltas: {}, flagSet: [], flagClear: [] },
        },
      ],
    },
    {
      id: 'd2',
      charactersPresent: ['kira'],
      characterEmotions: { kira: 'soft' },
      narration: 'Она пожимает плечами.',
      dialogue: [{ speaker: 'kira', emotion: 'soft', line: 'День как день, спасибо.' }],
      choices: [
        {
          id: 'c_bye2',
          kind: 'farewell',
          text: 'Пожелать хорошего вечера',
          next: 'd3',
          effects: { stateDeltas: { 'relationship[kira].affection': 0.05 }, flagSet: [], flagClear: [] },
        },
      ],
    },
    {
      id: 'd3',
      charactersPresent: ['kira'],
      characterEmotions: { kira: 'happy' },
      narration: 'Кира машет рукой.',
      dialogue: [{ speaker: 'kira', emotion: 'happy', line: 'До встречи!' }],
      choices: [],
      closing: true,
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

const compile = (unitProse: Record<string, DialogueUnit[]> = {}, eventUnits: Record<string, EventUnit> = {}) =>
  compileCalendarGameProject(brief, spine, cal, schedule, worldModel, {}, unitProse, eventUnits, endings);

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
    const { scenes } = compile({ enc_kira: [dialogueUnit] });
    expect(lintRouters(scenes)).toEqual([]);
  });

  it('граф без висячих целей: каждое ребро ведёт в существующий узел', () => {
    const { scenes } = compile({ enc_kira: [dialogueUnit] });
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

    const { scenes, project, stats } = compile({ enc_kira: [dialogueUnit] });
    expect(stats.encountersWired).toBe(2);

    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить с Кира')!;
    expect(meet).toBeTruthy();
    const meetEdge = scenes.edges.find(e => e.source === 'hub_loc_a' && e.sourceHandle === meet.id)!;
    expect(hasCond(meetEdge.condition, { path: 'slot', gte: 0 })).toBe(true);
    expect(hasCond(meetEdge.condition, { path: 'slot', lte: 2 })).toBe(true);
    expect(hasCond(meetEdge.condition, { path: 'met[kira].0', lte: 0 })).toBe(true);
    expect(project.settings.stateSchema?.vars['met[kira].0']).toEqual({ range: [0, 1], default: 0 });

    // Выход из диалога: met=1 и slot+1 на auto-advance closing-узла
    // (терминальная narration-сцена с прощальной репликой).
    const closingScenes = scenes.nodes.filter(n => n.id.endsWith('_d3'));
    expect(closingScenes.length).toBe(2); // по closing-сцене на каждый диапазон
    const exitOut = closingScenes[0].data.outputs[0];
    expect(exitOut.text).toBe('');
    expect(exitOut.effects?.stateDeltas?.slot).toBe(1);
    expect(Object.keys(exitOut.effects?.stateDeltas ?? {}).some(k => k.startsWith('met[kira].'))).toBe(true);
  });

  it('фикстура юнита структурно валидна (контракт фазы 3)', () => {
    expect(validateDialogueUnit(dialogueUnit, 'kira').filter(i => i.severity === 'error')).toEqual([]);
  });

  it('регресс полноты диалога: ask не ведёт в хаб; движение — только на closing-переходе', () => {
    const { scenes } = compile({ enc_kira: [dialogueUnit] });

    // Индексация: ребро по (source, sourceHandle).
    const edgeByHandle = new Map(scenes.edges.map(e => [`${e.source}::${e.sourceHandle}`, e]));
    const nodeById = new Map(scenes.nodes.map(n => [n.id, n]));

    let choiceOutputs = 0;
    let movementOutputs = 0;
    for (const node of scenes.nodes) {
      if (node.data.sceneType !== 'dialogue' && node.data.sceneType !== 'narration') continue;
      for (const out of node.data.outputs) {
        const edge = edgeByHandle.get(`${node.id}::${out.id}`);
        if (!edge) continue;

        // 1. Любой ВЫБОР игрока в диалоге (output с текстом у dialogue-сцены)
        //    остаётся внутри юнита: ребро НЕ ведёт в hub_*. Единственная
        //    дорога в хаб — auto-advance closing-узла.
        if (node.data.sceneType === 'dialogue' && out.text !== '') {
          choiceOutputs++;
          expect(edge.target.startsWith('hub_'), `выбор "${out.text}" (${node.id}) ведёт в ${edge.target}`).toBe(false);
          // Собственные эффекты выбора не трогают движение.
          const deltas = Object.keys(out.effects?.stateDeltas ?? {});
          expect(deltas.some(k => k === 'slot' || k.startsWith('met['))).toBe(false);
        }

        // 2. Эффекты движения (slot/met) — ТОЛЬКО на auto-advance closing-узла:
        //    narration-сцена с единственным пустым output, ребро в hub_*.
        const deltas = Object.keys(out.effects?.stateDeltas ?? {});
        const touchesMovement = deltas.some(k => k === 'slot' || k.startsWith('met['));
        const isWaitButton = out.text === 'Подождать'; // хаб-кнопка тоже двигает slot
        const isBeatExit = spine.beats.some(b => b.id === node.id); // биты двигают slot сами
        if (touchesMovement && !isWaitButton && !isBeatExit) {
          movementOutputs++;
          const src = nodeById.get(node.id)!;
          expect(src.data.sceneType, `движение вне closing-narration: ${node.id}`).toBe('narration');
          expect(src.data.outputs).toHaveLength(1);
          expect(out.text).toBe('');
          expect(edge.target.startsWith('hub_'), `closing-переход ${node.id} ведёт в ${edge.target}`).toBe(true);
        }
      }
    }
    // Санити: ассерты реально сработали (2 диапазона × (2+1) выбора; 2 closing).
    expect(choiceOutputs).toBeGreaterThanOrEqual(6);
    expect(movementOutputs).toBe(2);
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

// ── Фаза 4: встречи PER dialogue-юнит пула событий ─────────────────────────

/** Два юнита Киры с fired-цепочкой: talk (loc_a, 0-2) → deep (loc_b, 6-8). */
const eventUnit = (patch: Partial<EventUnit> & Pick<EventUnit, 'id'>): EventUnit => ({
  kind: 'dialogue',
  at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'loc_a' },
  participants: ['kira'],
  guard: { all: [] },
  effects: [],
  scene: { kind: 'dialogue', anchorId: patch.id, liId: 'kira' },
  priority: 20,
  goal: 'цель встречи',
  arcStage: 1,
  source: 'agenda',
  ...patch,
});

const unitTalk = eventUnit({
  id: 'evt_kira_talk',
  guard: guardFromRequires(['met_all']),
  effects: [{ rel: { char: 'kira', var: 'affection', delta: 0.1 } }, { setFlag: 'likes_books' }],
});

const unitDeep = eventUnit({
  id: 'evt_kira_deep',
  at: { slot: { fromSlot: 6, toSlot: 8 }, locationId: 'loc_b' },
  guard: { all: [{ fired: 'evt_kira_talk' }] },
  arcStage: 2,
});

const eventUnits: Record<string, EventUnit> = {
  [unitTalk.id]: unitTalk,
  [unitDeep.id]: unitDeep,
};

/** Проза обоих юнитов — одна и та же валидная фикстура DialogueUnit. */
const unitProseByUnit: Record<string, DialogueUnit[]> = {
  [unitTalk.id]: [dialogueUnit],
  [unitDeep.id]: [dialogueUnit],
};

describe('compileCalendarGameProject: юниты пула событий', () => {
  const compileUnits = () => compile(unitProseByUnit, eventUnits);

  it('кнопка юнита гейтится окном, флагами guard-а и одноразовостью met[unit]', () => {
    const { scenes, project } = compileUnits();
    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить с Кира')!;
    expect(meet).toBeTruthy();
    const edge = scenes.edges.find(e => e.source === 'hub_loc_a' && e.sourceHandle === meet.id)!;
    expect(hasCond(edge.condition, { path: 'slot', gte: 0 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'slot', lte: 2 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'met[evt_kira_talk]', lte: 0 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'flag[met_all]', gte: 1 })).toBe(true);
    expect(project.settings.stateSchema?.vars['unit[evt_kira_talk]']).toEqual({ range: [0, 1], default: 0 });
    expect(project.settings.stateSchema?.vars['flag[likes_books]']).toEqual({ range: [0, 1], default: 0 });
  });

  it('fired-цепочка компилируется в unit[<dep>] ≥ 1 на кнопке зависимого юнита', () => {
    const { scenes } = compileUnits();
    const hubB = scenes.nodes.find(n => n.id === 'hub_loc_b')!;
    const meet = hubB.data.outputs.find(o => o.text === 'Поговорить с Кира')!;
    const edge = scenes.edges.find(e => e.source === 'hub_loc_b' && e.sourceHandle === meet.id)!;
    expect(hasCond(edge.condition, { path: 'unit[evt_kira_talk]', gte: 1 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'slot', gte: 6 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'slot', lte: 8 })).toBe(true);
  });

  it('closing-переход ставит met[unit] + unit[<id>] + establishes-флаги и двигает slot', () => {
    const { scenes } = compileUnits();
    // Closing-сцены (d3) обоих юнитов; talk несёт establishes likes_books.
    const closings = scenes.nodes.filter(n => n.id.includes('evt_kira_talk') && n.id.endsWith('_d3'));
    expect(closings.length).toBe(1);
    const deltas = closings[0].data.outputs[0].effects?.stateDeltas ?? {};
    expect(deltas).toEqual({
      'met[evt_kira_talk]': 1,
      'unit[evt_kira_talk]': 1,
      'flag[likes_books]': 1,
      slot: 1,
    });
    // Возврат — в хаб локации юнита.
    const edge = scenes.edges.find(e => e.source === closings[0].id)!;
    expect(edge.target).toBe('hub_loc_a');
  });

  it('юнит без прозы пропускается; расписаний-диапазонов при юнитах нет', () => {
    const { scenes, stats } = compile({ [unitTalk.id]: [dialogueUnit] }, eventUnits);
    expect(stats.encountersWired).toBe(1); // deep без прозы не проводится
    const hubB = scenes.nodes.find(n => n.id === 'hub_loc_b')!;
    expect(hubB.data.outputs.some(o => o.text.startsWith('Поговорить'))).toBe(false);
  });

  it('регресс полноты: выбор в диалоге юнита не ведёт в хаб; lintRouters чист', () => {
    const { scenes } = compileUnits();
    expect(lintRouters(scenes)).toEqual([]);
    const edgeByHandle = new Map(scenes.edges.map(e => [`${e.source}::${e.sourceHandle}`, e]));
    let checked = 0;
    for (const node of scenes.nodes) {
      if (node.data.sceneType !== 'dialogue') continue;
      for (const out of node.data.outputs) {
        if (out.text === '') continue;
        const edge = edgeByHandle.get(`${node.id}::${out.id}`);
        expect(edge && !edge.target.startsWith('hub_'), `выбор "${out.text}" (${node.id}) ведёт в хаб`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(4); // 2 юнита × ≥2 выбора
  });

  it('пустой пул → фаза-3 фолбэк: диапазоны расписания с ключом enc_<liId>', () => {
    const { scenes, stats } = compile({ enc_kira: [dialogueUnit] }, {});
    expect(stats.encountersWired).toBe(2);
    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить с Кира')!;
    const edge = scenes.edges.find(e => e.source === 'hub_loc_a' && e.sourceHandle === meet.id)!;
    expect(hasCond(edge.condition, { path: 'met[kira].0', lte: 0 })).toBe(true);
  });
});

// ── Фаза 5: истинные ветки — рост контента линейный, не умноженный ─────────

describe('compileCalendarGameProject: ветки (фаза 5)', () => {
  /** База (spine выше) + развилка в акте 2 + по ветвовому биту акта 3 на исход. */
  const branchBeats: SpineBeat[] = [
    beat({
      id: 'bp',
      kind: 'branchPoint',
      act: 2,
      window: { fromSlot: 3, toSlot: 5 },
      locationId: 'loc_b',
      outcomes: [
        { id: 'cover', label: 'Скрыть провал', setsFlag: 'chose_cover', summary: 'ложь растёт' },
        { id: 'truth', label: 'Рассказать правду', setsFlag: 'chose_truth', summary: 'честный путь' },
      ],
    }),
    beat({
      id: 'br_cover',
      act: 3,
      window: { fromSlot: 6, toSlot: 8 },
      locationId: 'loc_a',
      guard: guardFromRequires(['chose_cover']),
    }),
    beat({
      id: 'br_truth',
      act: 3,
      window: { fromSlot: 6, toSlot: 8 },
      locationId: 'loc_c',
      guard: guardFromRequires(['chose_truth']),
    }),
  ];
  const branchSpine: SpinePlan = { ...spine, beats: [...spine.beats, ...branchBeats] };
  const compileSpine = (s: SpinePlan) =>
    compileCalendarGameProject(brief, s, cal, schedule, worldModel, {}, {}, {}, endings);

  it('stats считает развилки и ветвовые биты', () => {
    const base = compileSpine(spine).stats;
    expect(base.branchPoints).toBe(0);
    expect(base.branchExclusiveBeats).toBe(0);

    const withBranch = compileSpine(branchSpine).stats;
    expect(withBranch.branchPoints).toBe(1);
    expect(withBranch.branchExclusiveBeats).toBe(2);
  });

  it('линейный рост: 3 добавленных бита = ровно 3 новых узла графа', () => {
    const base = compileSpine(spine).stats;
    const withBranch = compileSpine(branchSpine).stats;
    // Развилка + 2 ветвовых бита добавляют по одному узлу сцены каждый —
    // guard-ы вместо рёбер: ветка добавляет флаги, а не копии контента.
    expect(withBranch.totalNodes - base.totalNodes).toBe(branchBeats.length);
    expect(withBranch.beatsWired - base.beatsWired).toBe(branchBeats.length);
  });

  it('branchPoint — сцена-выбор: каждый исход ставит свой спайн-флаг и двигает slot', () => {
    const { scenes } = compileSpine(branchSpine);
    const bp = scenes.nodes.find(n => n.id === 'bp')!;
    expect(bp.data.sceneType).toBe('branch');
    expect(bp.data.outputs).toHaveLength(2);
    const byLabel = new Map(bp.data.outputs.map(o => [o.text, o]));
    expect(byLabel.get('Скрыть провал')!.effects?.stateDeltas?.['flag[chose_cover]']).toBe(1);
    expect(byLabel.get('Рассказать правду')!.effects?.stateDeltas?.['flag[chose_truth]']).toBe(1);
    for (const o of bp.data.outputs) {
      expect(o.effects?.stateDeltas?.slot).toBe(1);
      expect(o.effects?.stateDeltas?.['beat[bp]']).toBe(1);
    }
    // Ветвовой бит гейтится флагом исхода в enter-роутере своей локации.
    const edge = scenes.edges.find(e => e.source === 'enter_loc_a' && e.target === 'br_cover')!;
    expect(hasCond(edge.condition, { path: 'flag[chose_cover]', gte: 1 })).toBe(true);
  });
});
