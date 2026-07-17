import { describe, expect, it } from 'vitest';
import { compileCalendarGameProject, lintAnchorCoverage, lintRouters, scheduleRuns } from './compileCalendarGame';
import type { AnchorTransitionsInput } from './compileCalendarGame';
import { PHASES_PER_SLOT, guardFromRequires } from './calendarTypes';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import { DEFAULT_LOCATION_MOOD, endingKey } from './types';
import type { Brief, EndingVariant, WorldLocation, WorldModel } from './types';
import type { DialogueUnit } from './dialogueUnit';
import { validateDialogueUnit } from './dialogueUnit';
import type { GameSceneGraph, GameStateCondition } from './convertToGameProject';
import type { CharacterGenState } from './narrativeStore';

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

const compile = (
  unitProse: Record<string, DialogueUnit[]> = {},
  eventUnits: Record<string, EventUnit> = {},
  anchors: AnchorTransitionsInput = {},
) =>
  compileCalendarGameProject(
    brief,
    spine,
    cal,
    schedule,
    worldModel,
    {},
    unitProse,
    eventUnits,
    endings,
    {},
    {},
    undefined,
    anchors,
  );

const edgesFrom = (scenes: GameSceneGraph, source: string) => scenes.edges.filter(e => e.source === source);
const hasCond = (conds: GameStateCondition[] | undefined, c: GameStateCondition) =>
  (conds ?? []).some(x => x.path === c.path && x.gte === c.gte && x.lte === c.lte);

describe('compileCalendarGameProject', () => {
  it('обе стрелки времени в схеме: slot [0, slotCount], phase [0, P], обе с нуля', () => {
    const { project } = compile();
    expect(project.settings.stateSchema?.vars['slot']).toEqual({ range: [0, 12], default: 0 });
    // Нижняя граница фазы — она же механизм сброса: парная дельта −P на
    // slot-двигающем выходе клампится к нулю (правок движка не нужно).
    expect(project.settings.stateSchema?.vars['phase']).toEqual({ range: [0, PHASES_PER_SLOT], default: 0 });
    expect(project.settings.calendar).toEqual({
      slotCount: 12,
      dayparts: cal.dayparts,
      actBoundaries: [0, 1, 2, 3],
      phasesPerSlot: PHASES_PER_SLOT,
    });
  });

  it('«Подождать» не существует: время нельзя промотать вхолостую', () => {
    const { scenes } = compile();
    const wait = scenes.nodes.flatMap(n => n.data.outputs).filter(o => /подожд/i.test(o.text));
    expect(wait).toEqual([]);
  });

  it('в каждом хабе и каждом слоте есть якорный переход — иначе игрок застревает', () => {
    const { scenes } = compile();
    // Тот же инвариант доказывает и линт; здесь — явная проверка топологии.
    expect(lintAnchorCoverage(scenes, cal.slotCount)).toEqual([]);

    for (const l of worldModel.locations) {
      const hub = scenes.nodes.find(n => n.id === `hub_${l.id}`)!;
      const anchors = hub.data.outputs.filter(o =>
        scenes.edges.some(e => e.source === hub.id && e.sourceHandle === o.id && e.target.startsWith('anchor_')),
      );
      expect(anchors.length, `hub_${l.id} без якорей`).toBe(cal.dayparts.length);
      // В каждом слоте активен РОВНО один якорь — тот, чья часть дня сейчас.
      for (let v = 0; v < cal.slotCount; v++) {
        const active = scenes.edges.filter(
          e =>
            e.source === hub.id &&
            anchors.some(a => a.id === e.sourceHandle) &&
            (e.condition ?? []).every(c => (c.gte == null || v >= c.gte) && (c.lte == null || v <= c.lte)),
        );
        expect(active.length, `слот ${v} в hub_${l.id}`).toBe(1);
      }
    }
  });

  it('якорь двигает большую стрелку и СБРАСЫВАЕТ фазу; последний уводит спать домой', () => {
    const { scenes } = compile();
    const anchorNodes = scenes.nodes.filter(n => n.id.startsWith('anchor_loc_a_'));
    expect(anchorNodes).toHaveLength(cal.dayparts.length);
    for (const n of anchorNodes) {
      expect(n.data.sceneType).toBe('narration'); // это сцена, а не кнопка-промотка
      expect(n.data.label.length).toBeGreaterThan(0);
      expect(n.data.outputs[0].effects?.stateDeltas).toEqual({ slot: 1, phase: -PHASES_PER_SLOT });
    }
    // Сон (последняя часть дня) уводит в домашнюю локацию; фолбэк дома —
    // стартовая локация, когда тега 'home' нет.
    const sleep = scenes.nodes.find(n => n.id === `anchor_loc_a_${cal.dayparts.length - 1}`)!;
    expect(scenes.edges.find(e => e.source === sleep.id)!.target).toBe('enter_loc_a');
  });

  it('якорь ведёт домой, когда tagMap объявляет home', () => {
    const { scenes } = compile(undefined, undefined, { tagMap: { home: ['loc_b'] } });
    const sleep = scenes.nodes.find(n => n.id === `anchor_loc_a_${cal.dayparts.length - 1}`)!;
    expect(scenes.edges.find(e => e.source === sleep.id)!.target).toBe('enter_loc_b');
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

  it('выход бита ставит beat[id], establishes-флаги, двигает slot и СБРАСЫВАЕТ фазу', () => {
    const { scenes } = compile();
    const b1 = scenes.nodes.find(n => n.id === 'b1')!;
    expect(b1.data.outputs).toHaveLength(1);
    // Бит — сюжет, а сюжет двигает большую стрелку. Парная дельта phase:−P
    // обязательна: в новой части дня персонажи снова восприимчивы.
    expect(b1.data.outputs[0].effects?.stateDeltas).toEqual({
      'beat[b1]': 1,
      'flag[met_all]': 1,
      slot: 1,
      phase: -PHASES_PER_SLOT,
    });
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
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить: Кира')!;
    expect(meet).toBeTruthy();
    const meetEdge = scenes.edges.find(e => e.source === 'hub_loc_a' && e.sourceHandle === meet.id)!;
    expect(hasCond(meetEdge.condition, { path: 'slot', gte: 0 })).toBe(true);
    expect(hasCond(meetEdge.condition, { path: 'slot', lte: 2 })).toBe(true);
    expect(hasCond(meetEdge.condition, { path: 'met[kira].0', lte: 0 })).toBe(true);
    expect(project.settings.stateSchema?.vars['met[kira].0']).toEqual({ range: [0, 1], default: 0 });

    // Выход из диалога: met=1 и phase+1 на auto-advance closing-узла
    // (терминальная narration-сцена). Слот разговор НЕ двигает — иначе
    // вечерняя беседа заканчивалась бы утром, как в репортнутом плейтесте.
    const closingScenes = scenes.nodes.filter(n => n.id.endsWith('_d3'));
    expect(closingScenes.length).toBe(2); // по closing-сцене на каждый диапазон
    const exitOut = closingScenes[0].data.outputs[0];
    expect(exitOut.text).toBe('');
    expect(exitOut.effects?.stateDeltas?.phase).toBe(1);
    expect(exitOut.effects?.stateDeltas?.slot).toBeUndefined();
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
          expect(deltas.some(k => k === 'slot' || k === 'phase' || k.startsWith('met['))).toBe(false);
        }

        // 2. Эффекты движения (phase/met) — ТОЛЬКО на auto-advance closing-узла:
        //    narration-сцена с единственным пустым output, ребро в enter_*
        //    (не в хаб: созревший за разговор бит обязан выстрелить сразу).
        const deltas = Object.keys(out.effects?.stateDeltas ?? {});
        const touchesMovement = deltas.some(k => k === 'slot' || k === 'phase' || k.startsWith('met['));
        const isBeatExit = spine.beats.some(b => b.id === node.id); // биты двигают slot сами
        const isAnchor = node.id.startsWith('anchor_'); // якорь и есть двигатель большой стрелки
        if (touchesMovement && !isBeatExit && !isAnchor) {
          movementOutputs++;
          const src = nodeById.get(node.id)!;
          expect(src.data.sceneType, `движение вне closing-narration: ${node.id}`).toBe('narration');
          expect(src.data.outputs).toHaveLength(1);
          expect(out.text).toBe('');
          expect(edge.target.startsWith('enter_'), `closing-переход ${node.id} ведёт в ${edge.target}`).toBe(true);
          // Разговор большую стрелку не двигает — это ядро реформы времени.
          expect(deltas).not.toContain('slot');
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

  it('цепочка порядка: ребро бита требует сыгранного предшественника линии', () => {
    // b1(слот 0-2) → b2(3-5) → b3(6-8) — общая линия $plot (битов без LI).
    const { scenes } = compile();
    expect(
      hasCond(edgesFrom(scenes, 'enter_loc_b').find(e => e.target === 'b2')!.condition, { path: 'beat[b1]', gte: 1 }),
    ).toBe(true);
    expect(
      hasCond(edgesFrom(scenes, 'enter_loc_c').find(e => e.target === 'b3')!.condition, { path: 'beat[b2]', gte: 1 }),
    ).toBe(true);
  });

  it('голова линии и finale цепочкой не гейтятся', () => {
    const { scenes } = compile();
    const head = edgesFrom(scenes, 'enter_loc_a').find(e => e.target === 'b1')!;
    const fin = edgesFrom(scenes, 'enter_loc_a').find(e => e.target === 'fin')!;
    expect((head.condition ?? []).some(c => c.path.startsWith('beat[') && c.gte === 1)).toBe(false);
    expect((fin.condition ?? []).some(c => c.path.startsWith('beat[') && c.gte === 1)).toBe(false);
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

/** Вершина арки Киры (ступень 3 = верх легаси-лестницы): ставит arc_peak. */
const unitPeak = eventUnit({
  id: 'evt_kira_peak',
  at: { slot: { fromSlot: 9, toSlot: 11 }, locationId: 'loc_c' },
  guard: { all: [{ fired: 'evt_kira_deep' }] },
  arcStage: 3,
});

const eventUnits: Record<string, EventUnit> = {
  [unitTalk.id]: unitTalk,
  [unitDeep.id]: unitDeep,
  [unitPeak.id]: unitPeak,
};

/** Проза юнитов — одна и та же валидная фикстура DialogueUnit. */
const unitProseByUnit: Record<string, DialogueUnit[]> = {
  [unitTalk.id]: [dialogueUnit],
  [unitDeep.id]: [dialogueUnit],
  [unitPeak.id]: [dialogueUnit],
};

describe('compileCalendarGameProject: юниты пула событий', () => {
  const compileUnits = () => compile(unitProseByUnit, eventUnits);

  it('кнопка юнита гейтится окном, флагами guard-а и одноразовостью met[unit]', () => {
    const { scenes, project } = compileUnits();
    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить: Кира')!;
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
    const meet = hubB.data.outputs.find(o => o.text === 'Поговорить: Кира')!;
    const edge = scenes.edges.find(e => e.source === 'hub_loc_b' && e.sourceHandle === meet.id)!;
    expect(hasCond(edge.condition, { path: 'unit[evt_kira_talk]', gte: 1 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'slot', gte: 6 })).toBe(true);
    expect(hasCond(edge.condition, { path: 'slot', lte: 8 })).toBe(true);
  });

  it('closing-переход ставит met[unit] + unit[<id>] + establishes-флаги, гейн ступени и тратит ФАЗУ', () => {
    const { scenes } = compileUnits();
    // Closing-сцены (d3) обоих юнитов; talk несёт establishes likes_books.
    const closings = scenes.nodes.filter(n => n.id.includes('evt_kira_talk') && n.id.endsWith('_d3'));
    expect(closings.length).toBe(1);
    const deltas = closings[0].data.outputs[0].effects?.stateDeltas ?? {};
    expect(deltas).toMatchObject({
      'met[evt_kira_talk]': 1,
      'unit[evt_kira_talk]': 1,
      'flag[likes_books]': 1,
      phase: 1,
    });
    // Большая стрелка разговору не подчиняется: её двигает только сюжет.
    expect(deltas.slot).toBeUndefined();
    // Валюта арки: closing несёт ДЕТЕРМИНИРОВАННУЮ половину шага ступени —
    // не relEffects от LLM (жирные фармились бы, нулевые запирали бы лестницу).
    expect(deltas['relationship[kira].affection']).toBeGreaterThan(0);
    // Возврат — через enter-роутер: созревший за разговор бит стреляет сразу.
    const edge = scenes.edges.find(e => e.source === closings[0].id)!;
    expect(edge.target).toBe('enter_loc_a');
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

  it('rel-порог ступени доезжает до кнопки встречи (раньше молча выбрасывался)', () => {
    // unitDeep — ступень 2: вход требует накопленной близости, а не только флагов.
    const { scenes } = compileUnits();
    const hubB = scenes.nodes.find(n => n.id === 'hub_loc_b')!;
    const meet = hubB.data.outputs.find(o => /Поговорить/.test(o.text))!;
    const edge = scenes.edges.find(e => e.source === 'hub_loc_b' && e.sourceHandle === meet.id)!;
    const rel = (edge.condition ?? []).find(c => c.path === 'relationship[kira].affection');
    expect(rel).toBeTruthy();
    expect(rel!.gte).toBeGreaterThan(0);
  });

  it('ступень 1 порога не несёт — точка входа в линию остаётся открытой', () => {
    const { scenes } = compileUnits();
    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => /Поговорить/.test(o.text))!;
    const edge = scenes.edges.find(e => e.source === 'hub_loc_a' && e.sourceHandle === meet.id)!;
    expect((edge.condition ?? []).some(c => c.path.startsWith('relationship['))).toBe(false);
  });

  it('вершина арки ставит arc_peak-флаг, good-концовка его требует', () => {
    const { scenes, project } = compileUnits();
    // unitDeep — последняя ступень (N=3 при легаси-пуле) → closing ставит флаг.
    const setsPeak = scenes.nodes
      .flatMap(n => n.data.outputs)
      .some(o => o.effects?.stateDeltas?.['flag[arc_peak_kira]'] === 1);
    expect(setsPeak).toBe(true);
    expect(project.settings.stateSchema?.vars['flag[arc_peak_kira]']).toBeTruthy();

    // Концовка: affection можно накопить болтовнёй, вершину арки — только сыграв.
    const goodEdge = scenes.edges.find(e => e.source === 'ending_router' && e.id.includes('e_good'));
    expect(hasCond(goodEdge?.condition, { path: 'flag[arc_peak_kira]', gte: 1 })).toBe(true);
  });

  it('РЕГРЕСС «стартуем влюблёнными»: тёплый архетип на старте читается НЕЙТРАЛЬНО', () => {
    // Асель — forbidden, старт affection 0.5 («интерес есть сразу»). Пороги тона
    // были абсолютными (warm ≥ 0.3), поэтому в слоте 0, до единого выбора игрока,
    // роутер уводил в positive-ветку: персонаж звучал влюблённым с первой сцены.
    // Относительный порог (старт + 0.15 = 0.65) возвращает нейтраль.
    const aselUnit = eventUnit({
      id: 'evt_asel_intro',
      participants: ['asel'],
      scene: { kind: 'dialogue', anchorId: 'evt_asel_intro', liId: 'asel' },
    });
    const aselProse: DialogueUnit[] = [
      { ...dialogueUnit, id: 'u_asel_neutral', liId: 'asel', bracket: 'neutral' },
      { ...dialogueUnit, id: 'u_asel_positive', liId: 'asel', bracket: 'positive' },
    ];
    const { scenes, project } = compile({ [aselUnit.id]: aselProse }, { [aselUnit.id]: aselUnit });

    const start = project.settings.stateSchema?.vars['relationship[asel].affection']?.default ?? 0;
    expect(start).toBeCloseTo(0.5);

    const posEdge = scenes.edges.find(e => e.id.includes('__positive'))!;
    const gte = (posEdge.condition ?? []).find(c => c.path === 'relationship[asel].affection')?.gte ?? 0;
    expect(gte).toBeCloseTo(0.65);
    expect(start).toBeLessThan(gte); // на старте тёплая ветка ЗАКРЫТА
  });

  it('РЕГРЕСС: без проведённой вершины арки концовка её НЕ требует', () => {
    // Юнит вершины без прозы компилятор пропускает — гейт на его флаг сделал бы
    // good-концовку молча недостижимой. Гейтим только реально проведённые.
    const noPeakProse = { [unitTalk.id]: [dialogueUnit], [unitDeep.id]: [dialogueUnit] };
    const { scenes } = compile(noPeakProse, eventUnits);
    const goodEdge = scenes.edges.find(e => e.source === 'ending_router' && e.id.includes('e_good'));
    expect((goodEdge?.condition ?? []).some(c => c.path === 'flag[arc_peak_kira]')).toBe(false);
  });

  it('пустой пул → фаза-3 фолбэк: диапазоны расписания с ключом enc_<liId>', () => {
    const { scenes, stats } = compile({ enc_kira: [dialogueUnit] }, {});
    expect(stats.encountersWired).toBe(2);
    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить: Кира')!;
    const edge = scenes.edges.find(e => e.source === 'hub_loc_a' && e.sourceHandle === meet.id)!;
    expect(hasCond(edge.condition, { path: 'met[kira].0', lte: 0 })).toBe(true);
  });
});

// ── Продолжение разговора внутри посиделки ─────────────────────────────────

/**
 * Ступени пула разнесены по окнам, поэтому «разговор пошёл хорошо» не значило
 * ничего: следующая ступень ждала своего дня. Здесь две ступени Киры стоят в
 * одной локации с пересекающимися окнами — значит разговор можно продолжить
 * сразу, а стрелка частей дня при этом стоит.
 */
describe('продолжение разговора: время идёт минутами, а не частями дня', () => {
  const s1 = eventUnit({
    id: 'evt_kira_s1',
    arcStage: 1,
    at: { slot: { fromSlot: 0, toSlot: 5 }, locationId: 'loc_a' },
  });
  const s2 = eventUnit({
    id: 'evt_kira_s2',
    arcStage: 2,
    at: { slot: { fromSlot: 0, toSlot: 5 }, locationId: 'loc_a' },
    guard: { all: [{ fired: 'evt_kira_s1' }] },
  });
  const units = { [s1.id]: s1, [s2.id]: s2 };
  const prose = { [s1.id]: [dialogueUnit], [s2.id]: [dialogueUnit] };
  const compileCont = () => compile(prose, units);

  const contNode = (scenes: GameSceneGraph) => scenes.nodes.find(n => n.id.startsWith('cont_evt_kira_s1'))!;

  it('после первой ступени предлагается «Продолжить разговор» и «Попрощаться»', () => {
    const { scenes } = compileCont();
    const cont = contNode(scenes);
    expect(cont).toBeTruthy();
    expect(cont.data.outputs.map(o => o.text)).toEqual(['Продолжить разговор', 'Попрощаться']);
    // Кнопки видны игроку — рендерер показывает выборы у не-narration сцен.
    expect(cont.data.sceneType).toBe('branch');
  });

  it('посиделка НЕ двигает большую стрелку: каждая ступень тратит фазу', () => {
    // Ядро реформы. Раньше посиделка стоила ровно один слот — и живой плейтест
    // показал абсурд: разговор начинался вечером, а после прощания наступало
    // утро следующего дня. Ночь исчезала как побочный эффект прощания.
    const { scenes } = compileCont();
    const cont = contNode(scenes);
    const at = (deltas?: Record<string, number>) => ({ slot: deltas?.slot ?? 0, phase: deltas?.phase ?? 0 });

    // Закрытие первой ступени: фаза потрачена, часть дня та же.
    const firstClosing = scenes.nodes.find(n => n.id.startsWith('enc_evt_kira_s1_') && n.id.endsWith('_d3'))!;
    expect(at(firstClosing.data.outputs[0].effects?.stateDeltas)).toEqual({ slot: 0, phase: 1 });

    // Продолжение тратит СВОЮ фазу — кап «ступеней за присест» стал
    // арифметическим (запас фаз слота), а не структурным.
    const contClosing = scenes.nodes.find(n => n.id.startsWith('enc_cont_evt_kira_s2_') && n.id.endsWith('_d3'))!;
    expect(at(contClosing.data.outputs[0].effects?.stateDeltas)).toEqual({ slot: 0, phase: 1 });

    // Ни развилка, ни прощание времени не двигают вовсе.
    const goOn = cont.data.outputs.find(o => o.text === 'Продолжить разговор')!;
    const bye = cont.data.outputs.find(o => o.text === 'Попрощаться')!;
    expect(at(goOn.effects?.stateDeltas)).toEqual({ slot: 0, phase: 0 });
    expect(at(bye.effects?.stateDeltas)).toEqual({ slot: 0, phase: 0 });
  });

  it('вход в продолжение гейтится незакончившимся слотом, а не свежей фазой', () => {
    // Правило продолжения: восприимчивость гейтит ЗАВЕДЕНИЕ разговора, а не
    // идущий. Требуй тут окно at.phase ступени 2 (early = фаза 0) — и
    // продолжение стало бы невозможным: первая ступень уже потратила фазу.
    const { scenes } = compileCont();
    const cont = contNode(scenes);
    const goOn = cont.data.outputs.find(o => o.text === 'Продолжить разговор')!;
    const edge = scenes.edges.find(e => e.source === cont.id && e.sourceHandle === goOn.id)!;
    expect(hasCond(edge.condition, { path: 'phase', lte: PHASES_PER_SLOT - 1 })).toBe(true);
    expect((edge.condition ?? []).some(c => c.path === 'phase' && c.gte != null)).toBe(false);
  });

  it('«Продолжить» несёт полные условия входа следующей ступени, включая порог близости', () => {
    const { scenes } = compileCont();
    const cont = contNode(scenes);
    const goOn = cont.data.outputs.find(o => o.text === 'Продолжить разговор')!;
    const edge = scenes.edges.find(e => e.source === cont.id && e.sourceHandle === goOn.id)!;
    expect(hasCond(edge.condition, { path: 'met[evt_kira_s2]', lte: 0 })).toBe(true);
    // Порог ступени 2: тёплый разговор откроет его тут же, холодный — нет.
    expect((edge.condition ?? []).some(c => c.path === 'relationship[kira].affection' && (c.gte ?? 0) > 0)).toBe(true);
    // fired-деп на саму первую встречу — тавтология, его тут быть не должно.
    expect((edge.condition ?? []).some(c => c.path === 'unit[evt_kira_s1]')).toBe(false);
  });

  it('кап: у продолжения своего продолжения нет — каскад ступеней структурно невозможен', () => {
    const { scenes } = compileCont();
    expect(scenes.nodes.filter(n => n.id.startsWith('cont_'))).toHaveLength(1);
    const contClosing = scenes.nodes.find(n => n.id.startsWith('enc_cont_evt_kira_s2_') && n.id.endsWith('_d3'))!;
    // Возврат — через enter-роутер, как у любого закрытия встречи.
    expect(scenes.edges.find(e => e.source === contClosing.id)!.target).toBe('enter_loc_a');
  });

  it('met общий: сыграв продолжением, игрок закрывает и свежую кнопку той же встречи', () => {
    const { scenes } = compileCont();
    const setsMet = scenes.nodes
      .flatMap(n => n.data.outputs)
      .filter(o => o.effects?.stateDeltas?.['met[evt_kira_s2]'] === 1);
    expect(setsMet.length).toBeGreaterThanOrEqual(2); // свежий и продолженный экземпляры
  });

  it('прощание безусловно и последнее; lintRouters чист', () => {
    const { scenes } = compileCont();
    const cont = contNode(scenes);
    const byeEdge = scenes.edges.find(e => e.source === cont.id && e.id.includes('__bye'))!;
    expect(byeEdge.condition).toBeUndefined();
    expect(lintRouters(scenes)).toEqual([]);
  });

  it('в разных локациях продолжения нет — разговор не телепортирует', () => {
    const far = { ...s2, at: { slot: { fromSlot: 0, toSlot: 5 }, locationId: 'loc_b' } };
    const { scenes } = compile({ [s1.id]: [dialogueUnit], [far.id]: [dialogueUnit] }, { [s1.id]: s1, [far.id]: far });
    expect(scenes.nodes.filter(n => n.id.startsWith('cont_'))).toHaveLength(0);
  });

  it('непересекающиеся окна продолжения не дают', () => {
    const late = { ...s2, at: { slot: { fromSlot: 8, toSlot: 11 }, locationId: 'loc_a' } };
    const { scenes } = compile(
      { [s1.id]: [dialogueUnit], [late.id]: [dialogueUnit] },
      { [s1.id]: s1, [late.id]: late },
    );
    expect(scenes.nodes.filter(n => n.id.startsWith('cont_'))).toHaveLength(0);
  });
});

// ── Регрессия репортнутого бага: признание без единого разговора ───────────

/**
 * Топология из плейтеста: Юки стоит в кафе по расписанию (бита там НЕТ), а её
 * ЕДИНСТВЕННЫЙ сюжетный бит — интимное признание в парке. Цепочка beat→beat
 * тут бессильна (предшественника нет) — держит гейт головы линии на встречу,
 * запланированную строго раньше.
 */
describe('регрессия: интимный бит не стреляет до разговора', () => {
  const parkSpine: SpinePlan = {
    title: 'Осенние тени',
    logline: '',
    beats: [
      beat({
        id: 'park_confession',
        act: 3,
        window: { fromSlot: 6, toSlot: 8 },
        locationId: 'loc_c',
        participants: ['yuki'],
        summary: 'Юки признаётся в своих страхах',
      }),
      beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 }, locationId: 'loc_a' }),
    ],
    endings: [{ id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } }],
  };

  // Юки в кафе (loc_a) слоты 0-2, в парке (loc_c) слоты 6-8.
  const yukiSchedule: CharacterSchedule = {
    yuki: ['loc_a', 'loc_a', 'loc_a', null, null, null, 'loc_c', 'loc_c', 'loc_c', null, null, null],
  };

  const cafeUnit = eventUnit({
    id: 'filler_yuki_loc_a_0',
    at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'loc_a' },
    participants: ['yuki'],
    scene: { kind: 'dialogue', anchorId: 'filler_yuki_loc_a_0', liId: 'yuki' },
    source: 'filler',
    goal: 'знакомство',
  });

  const compilePark = () =>
    compileCalendarGameProject(
      brief,
      parkSpine,
      cal,
      yukiSchedule,
      worldModel,
      {},
      { [cafeUnit.id]: [dialogueUnit] },
      { [cafeUnit.id]: cafeUnit },
      endings,
    );

  it('ребро признания требует сыгранной кафе-встречи', () => {
    const { scenes } = compilePark();
    const edge = edgesFrom(scenes, 'enter_loc_c').find(e => e.target === 'park_confession')!;
    expect(edge).toBeTruthy();
    expect(hasCond(edge.condition, { path: 'unit[filler_yuki_loc_a_0]', gte: 1 })).toBe(true);
  });

  it('в кафе есть кнопка «Поговорить: Юки», её closing ставит unit[…] = 1', () => {
    const { scenes } = compilePark();
    const hubA = scenes.nodes.find(n => n.id === 'hub_loc_a')!;
    const meet = hubA.data.outputs.find(o => o.text === 'Поговорить: Юки');
    expect(meet).toBeTruthy();
    // Ключ разблокировки признания ставится именно закрытием разговора.
    const setsUnit = scenes.nodes
      .flatMap(n => n.data.outputs)
      .some(o => o.effects?.stateDeltas?.['unit[filler_yuki_loc_a_0]'] === 1);
    expect(setsUnit).toBe(true);
  });

  it('без кафе-встречи признание остаётся негейтнутым (дедлока не создаём)', () => {
    const { scenes } = compileCalendarGameProject(brief, parkSpine, cal, yukiSchedule, worldModel, {}, {}, {}, endings);
    const edge = edgesFrom(scenes, 'enter_loc_c').find(e => e.target === 'park_confession')!;
    expect((edge.condition ?? []).some(c => c.path.startsWith('unit['))).toBe(false);
  });

  it('lintRouters чист при гейтнутой голове', () => {
    expect(lintRouters(compilePark().scenes)).toEqual([]);
  });
});

// ── Пер-строчный трек спрайтов: поза говорящего следует эмоции реплики ──────

describe('compileCalendarGameProject: lines со спрайтами по эмоции строки', () => {
  const characters: Record<string, CharacterGenState> = {
    kira: {
      status: 'done',
      idleFilename: 'kira_idle.png',
      poseFilenames: { soft: 'kira_soft.png', happy: 'kira_happy.png' },
    },
  };

  /** d2: эмоция узла soft, но реплика happy — спрайт строки должен разойтись с узловым. */
  const divergentUnit: DialogueUnit = JSON.parse(JSON.stringify(dialogueUnit));
  divergentUnit.nodes[1].dialogue[0].emotion = 'happy';

  const compileChars = () =>
    compileCalendarGameProject(
      brief,
      spine,
      cal,
      schedule,
      worldModel,
      {},
      { enc_kira: [divergentUnit] },
      {},
      endings,
      {},
      characters,
    );

  it('нарратив — строка без speaker, наследует позу первой реплики; реплика — с именем', () => {
    const { scenes } = compileChars();
    const d2 = scenes.nodes.find(n => n.id.endsWith('_d2') && n.data.lines)!;
    expect(d2.data.lines).toHaveLength(2);
    const [narr, line] = d2.data.lines!;
    expect(narr.speaker).toBeUndefined();
    expect(narr.text).toBe('Она пожимает плечами.');
    // Нарратив — сценическая ремарка к первой реплике (happy), не узловая soft.
    expect(narr.sprites![0].url).toContain('kira_happy.png');
    expect(line.speaker).toBe('Кира');
    expect(line.text).toBe('День как день, спасибо.');
  });

  it('спрайт реплики следует эмоции строки, узловой набор остаётся фолбэком', () => {
    const { scenes } = compileChars();
    const d2 = scenes.nodes.find(n => n.id.endsWith('_d2') && n.data.lines)!;
    // Узловой набор — доминантная эмоция сцены (soft).
    expect(d2.data.sprites![0].url).toContain('kira_soft.png');
    // Строка реплики — эмоция самой реплики (happy).
    expect(d2.data.lines![1].sprites![0].url).toContain('kira_happy.png');
  });

  it('эмоция без спрайта падает в idle-фолбэк и не ломает трек', () => {
    const { scenes } = compileChars();
    // d1: эмоция idle → idleFilename для узла и строк.
    const d1 = scenes.nodes.find(n => n.id.endsWith('_d1') && n.data.lines)!;
    expect(d1.data.sprites![0].url).toContain('kira_idle.png');
    expect(d1.data.lines![1].sprites![0].url).toContain('kira_idle.png');
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

describe('прощание — не конец ступени, а отдельная сцена ухода', () => {
  // Живой плейтест: Асель говорит «Спасибо за разговор. Надеюсь, скоро
  // увидимся» — и следом «Асель не спешит уходить». Она попрощалась и не ушла,
  // потому что у посиделки есть продолжение. Прощальная проза обязана звучать
  // ТОЛЬКО при реальном уходе.
  const withFarewell: DialogueUnit = {
    ...dialogueUnit,
    farewell: { narration: 'Она собирает вещи.', dialogue: [{ speaker: 'kira', line: 'До встречи!' }] },
  };
  const s1 = eventUnit({
    id: 'evt_kira_s1',
    arcStage: 1,
    at: { slot: { fromSlot: 0, toSlot: 5 }, locationId: 'loc_a' },
  });
  const s2 = eventUnit({
    id: 'evt_kira_s2',
    arcStage: 2,
    at: { slot: { fromSlot: 0, toSlot: 5 }, locationId: 'loc_a' },
    guard: { all: [{ fired: 'evt_kira_s1' }] },
  });
  const compileF = (prose: DialogueUnit) =>
    compile({ [s1.id]: [prose], [s2.id]: [prose] }, { [s1.id]: s1, [s2.id]: s2 });

  it('«Попрощаться» ведёт в прощальную сцену, а «Продолжить» — нет', () => {
    const { scenes } = compileF(withFarewell);
    const cont = scenes.nodes.find(n => n.id.startsWith('cont_evt_kira_s1'))!;
    const bye = cont.data.outputs.find(o => o.text === 'Попрощаться')!;
    const goOn = cont.data.outputs.find(o => o.text === 'Продолжить разговор')!;

    const byeTarget = scenes.edges.find(e => e.source === cont.id && e.sourceHandle === bye.id)!.target;
    expect(byeTarget.startsWith('farewell_')).toBe(true);

    // Продолжение прощальную сцену не задевает — разговор идёт дальше.
    const goOnTarget = scenes.edges.find(e => e.source === cont.id && e.sourceHandle === goOn.id)!.target;
    expect(goOnTarget.startsWith('farewell_')).toBe(false);
  });

  it('прощальная сцена несёт свою прозу и уводит через enter', () => {
    const { scenes } = compileF(withFarewell);
    const scene = scenes.nodes.find(n => /^farewell_.*_neutral$/.test(n.id))!;
    expect(scene.data.sceneType).toBe('narration');
    expect(scene.data.label).toContain('До встречи!');
    expect(scenes.edges.find(e => e.source === scene.id)!.target).toBe('enter_loc_a');
  });

  it('роутер прощания кончается безусловным ребром — старая проза без farewell уходит молча', () => {
    const { scenes } = compileF(dialogueUnit); // без поля farewell
    expect(lintRouters(scenes)).toEqual([]);
    const router = scenes.nodes.find(n => n.id.startsWith('farewell_'))!;
    const outs = router.data.outputs;
    const lastEdge = scenes.edges.find(e => e.source === router.id && e.sourceHandle === outs[outs.length - 1].id)!;
    expect(lastEdge.condition).toBeUndefined();
    expect(lastEdge.target).toBe('enter_loc_a');
  });
});
