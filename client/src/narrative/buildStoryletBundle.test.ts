import { describe, expect, it } from 'vitest';
import { buildStoryletBundle } from './buildStoryletBundle';
import { PHASES_PER_SLOT, guardFromRequires } from './calendarTypes';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import { DEFAULT_LOCATION_MOOD, endingKey } from './types';
import type { Brief, EndingVariant, WorldLocation, WorldModel } from './types';
import type { DialogueUnit } from './dialogueUnit';
import { validateDialogueUnit } from './dialogueUnit';
import {
  STORY_BUNDLE_FORMAT_VERSION,
  DEFAULT_SELECTOR_CONFIG,
  validateStoryBundle,
  createSliceState,
  evalGuard,
} from 'gu-engine-story-core';
import type { Guard, StoryBundleV2 } from 'gu-engine-story-core';

const brief: Brief = SAMPLE_BRIEF;

/** 4 дня × 3 части = 12 слотов, по акту на день. */
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

const schedule: CharacterSchedule = {
  kira: ['loc_a', 'loc_a', 'loc_a', null, null, null, 'loc_b', 'loc_b', 'loc_b', null, null, null],
};

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
  farewell: { narration: 'Она уходит.', dialogue: [{ speaker: 'kira', emotion: 'soft', line: 'Пока.' }] },
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

/**
 * Вершина арки. Лестница этого пула трёхступенчата (effectiveStageCount
 * не опускается ниже 3), поэтому «последняя ступень» — именно stage 3:
 * без неё флаг arc_peak никто не ставит, и good-концовка его не требует.
 */
const unitPeak = eventUnit({
  id: 'evt_kira_peak',
  at: { slot: { fromSlot: 6, toSlot: 8 }, locationId: 'loc_b' },
  guard: { all: [{ fired: 'evt_kira_deep' }] },
  arcStage: 3,
});

const proseFor = (unitId: string): DialogueUnit[] => [{ ...dialogueUnit, id: `${unitId}_neutral` }];

const build = (
  unitProse: Record<string, DialogueUnit[]> = {},
  eventUnits: Record<string, EventUnit> = {},
  anchors: Parameters<typeof buildStoryletBundle>[12] = {},
) =>
  buildStoryletBundle(
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

const withPool = () =>
  build(
    {
      [unitTalk.id]: proseFor(unitTalk.id),
      [unitDeep.id]: proseFor(unitDeep.id),
      [unitPeak.id]: proseFor(unitPeak.id),
    },
    { [unitTalk.id]: unitTalk, [unitDeep.id]: unitDeep, [unitPeak.id]: unitPeak },
  );

/** Оценка guard-а вне контекста персонажа (концовки читают state напрямую). */
const evalStandalone = (guard: Guard, state: ReturnType<typeof createSliceState>) =>
  evalGuard(
    guard,
    {
      x: '',
      y: '',
      z: { z: 0 },
      R: { affection: 0, trust: 0, tension: 0 },
      H: { flags: state.flags, fired: state.fired },
    },
    state,
  );

describe('buildStoryletBundle — фикстура диалогового юнита валидна', () => {
  it('исходный DialogueUnit проходит собственный валидатор', () => {
    expect(validateDialogueUnit(dialogueUnit, 'kira').filter(i => i.severity === 'error')).toEqual([]);
  });
});

describe('buildStoryletBundle — форма бандла', () => {
  it('версия формата и структурная валидация без ошибок', () => {
    const { bundle } = withPool();
    expect(bundle.formatVersion).toBe(STORY_BUNDLE_FORMAT_VERSION);
    expect(validateStoryBundle(bundle).filter(i => i.severity === 'error')).toEqual([]);
  });

  it('календарь несёт обе стрелки времени', () => {
    const { bundle } = withPool();
    expect(bundle.calendar).toEqual({
      days: 4,
      dayparts: ['утро', 'день', 'вечер'],
      slotCount: 12,
      actBoundaries: [0, 1, 2, 3],
      phasesPerSlot: PHASES_PER_SLOT,
    });
  });

  it('якорь на КАЖДУЮ часть дня — анти-софтлок по построению', () => {
    const { bundle } = withPool();
    expect(bundle.anchors).toHaveLength(cal.dayparts.length);
    expect(bundle.anchors.map(a => a.daypartIndex)).toEqual([0, 1, 2]);
    // Сон — последняя часть дня, он и уводит домой.
    expect(bundle.anchors.filter(a => a.isSleep)).toHaveLength(1);
    expect(bundle.anchors[2].isSleep).toBe(true);
  });

  it('старт — локация самого раннего бита, а не первая в списке мира', () => {
    const { bundle } = withPool();
    expect(bundle.world.startLocationId).toBe('loc_a');
    expect(bundle.intro.text).toBe('Интро истории.');
  });

  it('дом по тегу tagMap.home; без тега — там же, где старт', () => {
    expect(withPool().bundle.world.homeLocationId).toBe('loc_a');
    const tagged = build(
      { [unitTalk.id]: proseFor(unitTalk.id) },
      { [unitTalk.id]: unitTalk },
      { tagMap: { home: ['loc_c'] } },
    );
    expect(tagged.bundle.world.homeLocationId).toBe('loc_c');
  });

  it('расписание едет как есть — детерминированная истина о присутствии', () => {
    expect(withPool().bundle.schedule).toEqual(schedule);
  });
});

describe('buildStoryletBundle — юниты как storylets', () => {
  it('юнит несёт guard целиком, а не перевод в численные условия', () => {
    const { bundle } = withPool();
    const deep = bundle.units.find(u => u.id === unitDeep.id)!;
    // fired-деп остаётся ссылкой на id, а не переменной unit[...] ≥ 1.
    expect(JSON.stringify(deep.guard)).toContain('"fired":"evt_kira_talk"');
  });

  it('юнит без прозы отбрасывается и попадает в статистику', () => {
    const { bundle, stats } = build(
      { [unitTalk.id]: proseFor(unitTalk.id) },
      { [unitTalk.id]: unitTalk, [unitDeep.id]: unitDeep },
    );
    expect(bundle.units.map(u => u.id)).toEqual([unitTalk.id]);
    expect(stats.unitsWithoutProse).toBe(1);
  });

  it('establishes-флаги становятся эффектами закрытия', () => {
    const { bundle } = withPool();
    const talk = bundle.units.find(u => u.id === unitTalk.id)!;
    expect(talk.effectsOnClose).toContainEqual({ setFlag: 'likes_books' });
  });

  it('числовые пути дельт выбора разворачиваются в rel-эффекты алгебры', () => {
    const { bundle } = withPool();
    const talk = bundle.units.find(u => u.id === unitTalk.id)!;
    const node = talk.variants[0].nodes.find(n => n.id === 'd2')!;
    expect(node.choices[0].effects).toEqual([{ rel: { char: 'kira', var: 'affection', delta: 0.05, clamp: [-1, 1] } }]);
    // В бандле не остаётся строковых путей вида relationship[...].
    expect(JSON.stringify(bundle.units)).not.toContain('relationship[');
  });

  it('проза пре-рендерена в строки: нарратив + реплики со спикерами', () => {
    const { bundle } = withPool();
    const entry = bundle.units[0].variants[0].nodes.find(n => n.id === 'd1')!;
    expect(entry.lines[0].text).toBe('Кира кивает.');
    expect(entry.lines[1]).toMatchObject({ speaker: 'Кира', text: 'Привет.' });
  });

  it('прощание — отдельное поле варианта, а не хвост тела сцены', () => {
    const { bundle } = withPool();
    const variant = bundle.units[0].variants[0];
    expect(variant.farewell?.lines.map(l => l.text)).toEqual(['Она уходит.', 'Пока.']);
    // Тело ступени кончается паузой: прощальной реплики среди закрывающих строк нет.
    const closing = variant.nodes.find(n => n.choices.length === 0)!;
    expect(closing.lines.every(l => l.text !== 'Она уходит.')).toBe(true);
  });

  it('закрывающий узел есть у каждого варианта — сцена обязана кончиться', () => {
    const { bundle } = withPool();
    for (const u of bundle.units) {
      for (const v of u.variants) expect(v.nodes.some(n => n.choices.length === 0)).toBe(true);
    }
  });
});

describe('buildStoryletBundle — хребет и концовки', () => {
  it('окно финала достаёт до потолка клампа — иначе игра кончается ничем', () => {
    const { bundle } = withPool();
    const fin = bundle.spine.beats.find(b => b.id === 'fin')!;
    expect(fin.window.toSlot).toBeGreaterThanOrEqual(cal.slotCount);
  });

  it('establishes бита — эффекты, исходы развилки — выборы с эффектами', () => {
    const branchSpine: SpinePlan = {
      ...spine,
      beats: [
        ...spine.beats,
        beat({
          id: 'bp',
          kind: 'branchPoint',
          act: 2,
          window: { fromSlot: 3, toSlot: 5 },
          locationId: 'loc_b',
          outcomes: [
            { id: 'o1', label: 'Пойти налево', setsFlag: 'went_left', summary: '' },
            { id: 'o2', label: 'Пойти направо', setsFlag: 'went_right', summary: '' },
          ],
        }),
      ],
    };
    const { bundle } = buildStoryletBundle(brief, branchSpine, cal, schedule, worldModel, {}, {}, {}, endings);
    const bp = bundle.spine.beats.find(b => b.id === 'bp')!;
    expect(bp.outcomes).toHaveLength(2);
    expect(bp.outcomes![0]).toMatchObject({ label: 'Пойти налево', effects: [{ setFlag: 'went_left' }] });
    const b1 = bundle.spine.beats.find(b => b.id === 'b1')!;
    expect(b1.effects).toEqual([{ setFlag: 'met_all' }]);
  });

  it('ветка добавляет только свои биты — рост линейный, а не копии графа', () => {
    const branchSpine: SpinePlan = {
      ...spine,
      beats: [
        ...spine.beats,
        beat({
          id: 'bp',
          kind: 'branchPoint',
          act: 2,
          window: { fromSlot: 3, toSlot: 5 },
          locationId: 'loc_b',
          outcomes: [
            { id: 'o1', label: 'Налево', setsFlag: 'went_left', summary: '' },
            { id: 'o2', label: 'Направо', setsFlag: 'went_right', summary: '' },
          ],
        }),
        beat({
          id: 'left_only',
          act: 3,
          window: { fromSlot: 6, toSlot: 8 },
          locationId: 'loc_c',
          guard: guardFromRequires(['went_left']),
        }),
      ],
    };
    const base = buildStoryletBundle(brief, spine, cal, schedule, worldModel, {}, {}, {}, endings);
    const branched = buildStoryletBundle(brief, branchSpine, cal, schedule, worldModel, {}, {}, {}, endings);
    expect(branched.stats.branchExclusiveBeats).toBe(1);
    // +развилка +эксклюзивный бит = ровно 2 узла хребта, без удвоения остального.
    expect(branched.bundle.spine.beats.length - base.bundle.spine.beats.length).toBe(2);
  });

  it('good-концовка запекает порог близости и вершину арки', () => {
    const { bundle } = withPool();
    const good = bundle.spine.endings.find(e => e.id === 'e_good')!;
    const json = JSON.stringify(good.guard);
    expect(json).toContain('"char":"kira"');
    expect(json).toContain('"affection"');
    // Вершина арки проведена (в пуле есть последняя ступень) → флаг гейтит.
    expect(json).toContain('arc_peak_kira');
  });

  it('вершину арки не требуют, когда её никто не ставит', () => {
    // Пул без прозы → ни одна ступень не сыграна, флаг arc_peak не ставится.
    const { bundle } = build({}, {});
    const good = bundle.spine.endings.find(e => e.id === 'e_good')!;
    expect(JSON.stringify(good.guard)).not.toContain('arc_peak_kira');
  });

  it('bad-концовка требует холода со ВСЕМИ — именованные rel-гейты', () => {
    const { bundle } = withPool();
    const bad = bundle.spine.endings.find(e => e.id === 'e_bad')!;
    const chars = brief.loveInterests.map(li => li.id);
    for (const id of chars) expect(JSON.stringify(bad.guard)).toContain(`"char":"${id}"`);
  });

  it('безусловные концовки проверяются последними — иначе закрыли бы условные', () => {
    const { bundle } = withPool();
    const leaves = (g: Guard): number =>
      'all' in g
        ? g.all.reduce((n, x) => n + leaves(x), 0)
        : 'any' in g
        ? g.any.reduce((n, x) => n + leaves(x), 0)
        : 'not' in g
        ? leaves(g.not)
        : 1;
    const counts = bundle.spine.endings.map(e => leaves(e.guard));
    const firstUnconditional = counts.indexOf(0);
    if (firstUnconditional !== -1) {
      expect(counts.slice(firstUnconditional).every(c => c === 0)).toBe(true);
    }
  });

  it('концовка «все холодны» ложна для персонажа, которого игрок не встретил', () => {
    const { bundle } = withPool();
    const bad = bundle.spine.endings.find(e => e.id === 'e_bad')!;
    // Пустое состояние: отношений нет вовсе — это «неизвестно», а не «холодно».
    expect(evalStandalone(bad.guard, createSliceState())).toBe(false);
  });
});

describe('buildStoryletBundle — стартовое состояние', () => {
  it('отношения заводятся дефолтами архетипов, а не нулями', () => {
    const { bundle } = withPool();
    for (const li of brief.loveInterests) {
      const rel = bundle.stateSchema.relationships[li.id];
      expect(rel).toBeDefined();
      expect(typeof rel.affection).toBe('number');
    }
  });

  it('пороги тона относительны старту архетипа: на старте все нейтральны', () => {
    const { bundle } = withPool();
    for (const member of bundle.cast) {
      const start = bundle.stateSchema.relationships[member.id].affection;
      expect(start).toBeLessThan(member.bracketThresholds.positiveGte);
      expect(start).toBeGreaterThan(member.bracketThresholds.negativeLte);
    }
  });

  it('вселенная флагов объявлена: флаги хребта и юнитов', () => {
    const { bundle } = withPool();
    expect(bundle.stateSchema.flags).toContain('met_all');
    expect(bundle.stateSchema.flags).toContain('likes_books');
  });
});

describe('buildStoryletBundle — настройки режиссуры', () => {
  it('по умолчанию едут дефолтные веса ядра', () => {
    expect(withPool().bundle.selector).toEqual(DEFAULT_SELECTOR_CONFIG);
  });

  it('авторские веса доезжают до бандла — правка без перегенерации', () => {
    const tuned = {
      ...DEFAULT_SELECTOR_CONFIG,
      topN: 1,
      varietyWindow: 4,
      seedPolicy: 'fixed' as const,
      fixedSeed: 777,
      weights: { ...DEFAULT_SELECTOR_CONFIG.weights, variety: 5 },
    };
    const { bundle } = buildStoryletBundle(
      brief,
      spine,
      cal,
      schedule,
      worldModel,
      {},
      { [unitTalk.id]: proseFor(unitTalk.id) },
      { [unitTalk.id]: unitTalk },
      endings,
      {},
      {},
      undefined,
      {},
      { selector: tuned },
    );
    expect(bundle.selector).toEqual(tuned);
  });

  it('заглушки прозы несут выборы — иначе прилежный и безразличный игрок неразличимы', () => {
    const { bundle } = buildStoryletBundle(
      brief,
      spine,
      cal,
      schedule,
      worldModel,
      {},
      {}, // прозы нет вовсе
      { [unitTalk.id]: unitTalk },
      endings,
      {},
      {},
      undefined,
      {},
      { stubMissingProse: true },
    );
    const entry = bundle.units[0].variants[0].nodes.find(n => n.choices.length > 0)!;
    expect(entry.choices).toHaveLength(2);
    const deltas = entry.choices.map(c =>
      c.effects.reduce((s, e) => s + ('rel' in e && e.rel.var === 'affection' ? e.rel.delta : 0), 0),
    );
    expect(Math.max(...deltas)).toBeGreaterThan(0);
    expect(Math.min(...deltas)).toBeLessThan(0);
  });

  it('без stubMissingProse юнит без прозы в бандл не попадает', () => {
    const { bundle, stats } = buildStoryletBundle(
      brief,
      spine,
      cal,
      schedule,
      worldModel,
      {},
      {},
      { [unitTalk.id]: unitTalk },
      endings,
    );
    expect(bundle.units).toHaveLength(0);
    expect(stats.unitsWithoutProse).toBe(1);
  });
});

describe('validateStoryBundle', () => {
  const good = (): StoryBundleV2 => withPool().bundle;

  it('ловит чужую версию формата', () => {
    const b = { ...good(), formatVersion: 1 as unknown as StoryBundleV2['formatVersion'] };
    expect(validateStoryBundle(b).some(i => i.severity === 'error')).toBe(true);
  });

  it('ловит выбор, ведущий в несуществующий узел', () => {
    const b = good();
    b.units[0].variants[0].nodes[0].choices[0].next = 'нет_такого';
    expect(validateStoryBundle(b).some(i => i.severity === 'error' && i.message.includes('нет_такого'))).toBe(true);
  });

  it('ловит нехватку якорей — это софтлок', () => {
    const b = good();
    b.anchors = b.anchors.slice(0, 1);
    expect(validateStoryBundle(b).some(i => i.severity === 'error' && i.message.includes('софтлок'))).toBe(true);
  });

  it('ловит вариант без закрывающего узла', () => {
    const b = good();
    b.units[0].variants[0].nodes = b.units[0].variants[0].nodes.filter(n => n.choices.length > 0);
    expect(validateStoryBundle(b).some(i => i.severity === 'error' && i.message.includes('закрывающего'))).toBe(true);
  });
});
