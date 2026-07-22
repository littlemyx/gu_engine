import { describe, expect, it } from 'vitest';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { PHASES_PER_SLOT, guardFromRequires } from './calendarTypes';
import { archetypeAffectionStart } from './ladderGuards';
import type { DialogueUnit } from './dialogueUnit';
import type { DialogueVariantBracket, SegmentIssue, WorldModel } from './types';
import { DEFAULT_LOCATION_MOOD } from './types';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { StoryQAInputs } from './storyQA';
import { buildStoryLeafQARequests, runStoryQAStructural, simulatePolicies, summarizePolicyReports } from './storyQA';

/** 4 дня × 3 части = 12 слотов, по акту на день (как в calendar.test). */
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

/** Хребет: 4 бита + 1 развилка; финал требует met_all, концовки — по ветке. */
const simSpine = (): SpinePlan => ({
  title: 't',
  logline: 'l',
  beats: [
    beat({ id: 'b1', act: 1, window: { fromSlot: 0, toSlot: 2 }, establishes: ['met_all'] }),
    beat({
      id: 'b2',
      act: 2,
      window: { fromSlot: 3, toSlot: 5 },
      locationId: 'loc_b',
      guard: guardFromRequires(['met_all']),
    }),
    beat({ id: 'b3', act: 3, window: { fromSlot: 6, toSlot: 8 } }),
    beat({
      id: 'bp',
      kind: 'branchPoint',
      act: 3,
      window: { fromSlot: 6, toSlot: 8 },
      outcomes: [
        { id: 'o1', label: 'x', setsFlag: 'path_x', summary: '' },
        { id: 'o2', label: 'y', setsFlag: 'path_y', summary: '' },
      ],
    }),
    beat({
      id: 'fin',
      kind: 'finale',
      act: 4,
      window: { fromSlot: 9, toSlot: 11 },
      locationId: 'loc_b',
      guard: guardFromRequires(['met_all']),
    }),
  ],
  endings: [
    { id: 'e1', kind: 'normal', liId: null, guard: guardFromRequires(['path_x']) },
    { id: 'e2', kind: 'normal', liId: null, guard: guardFromRequires(['path_y']) },
  ],
});

const unit = (id: string, loc: string, patch?: Partial<EventUnit>): EventUnit => ({
  id,
  kind: 'dialogue',
  at: { locationId: loc, slot: { fromSlot: 0, toSlot: 11 } },
  participants: ['kira'],
  guard: { all: [] },
  effects: [{ rel: { char: 'kira', var: 'affection', delta: 0.2 } }],
  priority: 10,
  goal: 'g',
  source: 'agenda',
  ...patch,
});

/** kira в loc_c, yuki в loc_b, asel за кадром — детерминированное расписание. */
const schedule: CharacterSchedule = {
  kira: new Array<string | null>(12).fill('loc_c'),
  yuki: new Array<string | null>(12).fill('loc_b'),
  asel: new Array<string | null>(12).fill(null),
};

/**
 * Мир симуляции: три связанные локации. Режиссёр ходит по карте, поэтому
 * симуляция без модели мира невозможна — раньше политике хватало расписания,
 * теперь она обязана ДОЙТИ до персонажа.
 */
const worldModel: WorldModel = {
  locations: [
    {
      id: 'loc_a',
      name: 'loc_a',
      description: 'a',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'loc_b', via: '' }],
      mood: DEFAULT_LOCATION_MOOD,
      specialKind: null,
    },
    {
      id: 'loc_b',
      name: 'loc_b',
      description: 'b',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'loc_c', via: '' }],
      mood: DEFAULT_LOCATION_MOOD,
      specialKind: null,
    },
    {
      id: 'loc_c',
      name: 'loc_c',
      description: 'c',
      pointsOfInterest: [],
      adjacent: [],
      mood: DEFAULT_LOCATION_MOOD,
      specialKind: null,
    },
  ],
  anchorLocations: {},
};

const mkInputs = (
  spine: SpinePlan,
  eventUnits: EventUnit[],
  unitProse: Record<string, DialogueUnit[]> = {},
): StoryQAInputs => ({
  brief: SAMPLE_BRIEF,
  calendar: cal,
  spine,
  schedule,
  castPlan: null,
  tagMap: null,
  worldModel,
  eventUnits,
  unitProse,
});

/** Минимальный структурно валидный диалог: entry → farewell → closing. */
const dlg = (bracket: DialogueVariantBracket, liId = 'kira'): DialogueUnit => ({
  id: `d_${bracket}`,
  liId,
  bracket,
  entryNodeId: 'n1',
  nodes: [
    {
      id: 'n1',
      charactersPresent: [liId],
      characterEmotions: {},
      narration: '',
      dialogue: [{ speaker: liId, line: 'привет' }],
      choices: [
        {
          id: 'c1',
          kind: 'farewell',
          text: 'мне пора',
          next: 'n2',
          effects: { stateDeltas: {}, flagSet: [], flagClear: [] },
        },
      ],
    },
    {
      id: 'n2',
      charactersPresent: [liId],
      characterEmotions: {},
      narration: '',
      dialogue: [{ speaker: liId, line: 'до встречи' }],
      choices: [],
      closing: true,
    },
  ],
});

const fullProse = (): DialogueUnit[] => [dlg('positive'), dlg('neutral'), dlg('negative')];

const errorsOf = (issues: SegmentIssue[]) => issues.filter(i => i.severity === 'error');

describe('runStoryQAStructural (D2)', () => {
  it('достижимый диалоговый юнит без прозы → error на каждый брекет', () => {
    const issues = runStoryQAStructural(mkInputs(simSpine(), [unit('u1', 'loc_c')], {}));
    const prose = errorsOf(issues).filter(i => i.scope === 'qa/prose/u1');
    expect(prose).toHaveLength(3); // positive, neutral, negative
    expect(prose[0].message).toContain('кнопка не появится');
  });

  it('юнит с полной валидной прозой не даёт prose-ошибок', () => {
    const issues = runStoryQAStructural(mkInputs(simSpine(), [unit('u1', 'loc_c')], { u1: fullProse() }));
    expect(issues.filter(i => i.scope === 'qa/prose/u1')).toHaveLength(0);
  });

  it('orphan-проза (ключ без юнита) → warning', () => {
    const issues = runStoryQAStructural(mkInputs(simSpine(), [], { ghost: fullProse() }));
    const orphan = issues.find(i => i.scope === 'qa/prose/ghost');
    expect(orphan?.severity).toBe('warning');
    expect(orphan?.message).toContain('без юнита');
  });

  it('флаг-призрак: требуется концовкой, не устанавливается ничем → error', () => {
    const spine = simSpine();
    spine.endings.push({ id: 'e3', kind: 'bad', liId: null, guard: guardFromRequires(['ghost_flag']) });
    const issues = runStoryQAStructural(mkInputs(spine, []));
    expect(errorsOf(issues).some(i => i.scope === 'qa/flags/ghost_flag')).toBe(true);
  });

  it('флаг, который устанавливает ТОЛЬКО юнит, призраком не считается (union источников)', () => {
    const spine = simSpine();
    spine.beats.find(b => b.id === 'b3')!.guard = guardFromRequires(['unit_flag']);
    const units = [unit('u1', 'loc_c', { effects: [{ setFlag: 'unit_flag' }] })];
    const issues = runStoryQAStructural(mkInputs(spine, units, { u1: fullProse() }));
    // validateSpine (видит только спайн) ошибётся — кросс-артефактная проверка нет.
    expect(issues.some(i => i.scope === 'qa/flags/unit_flag')).toBe(false);
    expect(issues.some(i => i.scope.startsWith('spine/') && i.message.includes('unit_flag'))).toBe(true);
  });

  it('невалидная проза достижимого юнита → error (кнопка не появится)', () => {
    const broken = dlg('neutral');
    broken.nodes[1].dialogue = []; // closing без прощальной реплики LI
    const prose = [dlg('positive'), broken, dlg('negative')];
    const issues = runStoryQAStructural(mkInputs(simSpine(), [unit('u1', 'loc_c')], { u1: prose }));
    expect(errorsOf(issues).some(i => i.scope === 'qa/prose/u1' && i.message.includes('bracket=neutral'))).toBe(true);
    // и сам дефект отражён с префиксом dialogue/<unitId>/
    expect(errorsOf(issues).some(i => i.scope.startsWith('dialogue/u1/'))).toBe(true);
  });
});

describe('simulatePolicies: цепочка порядка', () => {
  it('цепочка доезжает до симуляции: биты сыграны по порядку, нарушений нет', () => {
    // Ловушка remap-а: evaluateSlice пишет в fired id ДЕФА (beat:<id>), а
    // evalGuard сравнивает с сырым {fired}. Без remap ни одно звено цепочки не
    // выполнимо → b2/b3 не сыграют и финал не будет достигнут.
    const [report] = simulatePolicies(mkInputs(simSpine(), []), ['spine-only']);
    expect(report.orderViolations).toEqual([]);
    expect(report.reachedFinale).toBe(true);
    expect(report.firedBeats.indexOf('b1')).toBeLessThan(report.firedBeats.indexOf('b2'));
    expect(report.firedBeats).toContain('b3');
    expect(summarizePolicyReports([report]).filter(i => i.severity === 'error')).toEqual([]);
  });

  it('нарушение порядка в отчёте → error в summary', () => {
    const broken = { ...simulatePolicies(mkInputs(simSpine(), []), ['spine-only'])[0], orderViolations: ['b2 до b1'] };
    const errs = summarizePolicyReports([broken]).filter(i => i.severity === 'error');
    expect(errs.some(i => i.message.includes('порядок битов нарушен'))).toBe(true);
  });

  it('РЕПОРТНУТЫЙ БАГ: признание не стреляет до кафе-разговора, финал достижим', () => {
    // Юки в кафе (loc_c) слоты 0-5, в парке (loc_b) слоты 6-8; её единственный
    // бит — признание в парке. Гейт головы = кафе-встреча строго раньше.
    const parkSpine: SpinePlan = {
      title: 't',
      logline: 'l',
      beats: [
        beat({
          id: 'park_confession',
          act: 3,
          window: { fromSlot: 6, toSlot: 8 },
          locationId: 'loc_b',
          participants: ['yuki'],
        }),
        beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 }, locationId: 'loc_b' }),
      ],
      endings: [{ id: 'e1', kind: 'normal', liId: null, guard: { all: [] } }],
    };
    const cafeUnit = unit('filler_yuki_loc_c_0', 'loc_c', {
      participants: ['yuki'],
      at: { locationId: 'loc_c', slot: { fromSlot: 0, toSlot: 5 } },
      effects: [],
    });
    const yukiSched: CharacterSchedule = {
      ...schedule,
      yuki: [
        'loc_c',
        'loc_c',
        'loc_c',
        'loc_c',
        'loc_c',
        'loc_c',
        'loc_b',
        'loc_b',
        'loc_b',
        'loc_b',
        'loc_b',
        'loc_b',
      ],
    };

    // Игрок ходит за Юки: кафе → парк. Разговор случается РАНЬШЕ признания.
    const [followsYuki] = simulatePolicies({ ...mkInputs(parkSpine, [cafeUnit]), schedule: yukiSched }, [
      'greedy-li:yuki',
    ]);
    expect(followsYuki.firedUnits).toContain('filler_yuki_loc_c_0');
    expect(followsYuki.firedBeats).toContain('park_confession');
    expect(followsYuki.orderViolations).toEqual([]);
    expect(followsYuki.reachedFinale).toBe(true);

    // Без кафе-встречи в пуле признание недостижимо, но финал безусловен —
    // история всё равно завершается (гейт не создаёт дедлока).
    const [noTalk] = simulatePolicies({ ...mkInputs(parkSpine, []), schedule: yukiSched }, ['greedy-li:yuki']);
    expect(noTalk.reachedFinale).toBe(true);
  });

  it('гейт головы не даёт ложной ошибки spine-only (та в кафе не заходит)', () => {
    // spine-only ходит ТОЛЬКО по локациям битов, поэтому кафе-встречу зажечь не
    // может и признание у неё не сыграет. Но финал безусловен и конвергентен —
    // достижимость финала не страдает, значит освобождать spine-only от
    // unit-гейтов не нужно: ложного «не достигает финала» нет.
    const parkSpine: SpinePlan = {
      title: 't',
      logline: 'l',
      beats: [
        beat({
          id: 'park_confession',
          act: 3,
          window: { fromSlot: 6, toSlot: 8 },
          locationId: 'loc_b',
          participants: ['yuki'],
        }),
        beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 }, locationId: 'loc_b' }),
      ],
      endings: [{ id: 'e1', kind: 'normal', liId: null, guard: { all: [] } }],
    };
    const cafeUnit = unit('filler_yuki_loc_c_0', 'loc_c', {
      participants: ['yuki'],
      at: { locationId: 'loc_c', slot: { fromSlot: 0, toSlot: 5 } },
      effects: [],
    });
    const [report] = simulatePolicies(mkInputs(parkSpine, [cafeUnit]), ['spine-only']);
    expect(report.reachedFinale).toBe(true);
    expect(report.orderViolations).toEqual([]);
    expect(summarizePolicyReports([report]).filter(i => i.severity === 'error')).toEqual([]);
  });
});

describe('simulatePolicies: лестница отношений', () => {
  /** Пул Юки: ступень 1 (кафе, рано) → ступень 2 (кафе, позже). */
  const ladderUnits = (): EventUnit[] => [
    unit('y1', 'loc_b', {
      participants: ['yuki'],
      at: { locationId: 'loc_b', slot: { fromSlot: 0, toSlot: 2 } },
      effects: [],
      arcStage: 1,
    }),
    unit('y2', 'loc_b', {
      participants: ['yuki'],
      at: { locationId: 'loc_b', slot: { fromSlot: 3, toSlot: 11 } },
      effects: [],
      arcStage: 2,
    }),
  ];

  it('отношения стартуют с АРХЕТИПНЫХ значений, а не с нуля', () => {
    // Слепое пятно: forbidden-архетип (Асель) начинает игру на 0.5, а симуляция
    // считала с нуля — то есть проверяла игру, которой не существует.
    const [r] = simulatePolicies(mkInputs(simSpine(), []), ['spine-only']);
    expect(r.relFinal.asel).toBeCloseTo(archetypeAffectionStart(SAMPLE_BRIEF, 'asel'));
    expect(r.relFinal.asel).toBeGreaterThan(0.4);
  });

  it('холодный прогон НЕ поднимается на ступень 2, тёплый — поднимается', () => {
    // Ровно то, ради чего лестница: близость нельзя набрать одним присутствием.
    const inputs = { ...mkInputs(simSpine(), ladderUnits()), unitProse: {} };
    const [cold] = simulatePolicies(inputs, ['greedy-li:yuki']); // choiceBias 0
    const [warm] = simulatePolicies(inputs, ['warm-li:yuki']);
    expect(cold.firedUnits).toContain('y1');
    expect(cold.firedUnits).not.toContain('y2'); // порог ступени 2 не взят
    expect(warm.firedUnits).toContain('y2'); // тёплые выборы открыли ступень
  });
});

describe('simulatePolicies (D3)', () => {
  it('spine-only достигает финала и концовки первой ветки', () => {
    const inputs = mkInputs(simSpine(), [unit('u1', 'loc_c'), unit('u2', 'loc_a')], {
      u1: fullProse(),
      u2: fullProse(),
    });
    const [report] = simulatePolicies(inputs, ['spine-only']);
    expect(report.policy).toBe('spine-only');
    expect(report.reachedFinale).toBe(true);
    expect(report.endingSatisfied).toBe('e1'); // branchPoint → первый исход → path_x
    expect(report.firedBeats).toEqual(['b1', 'b2', 'b3', 'bp', 'fin']);
    // Разговоров НЕТ: встреча требует, чтобы игрок нажал «Поговорить», а
    // spine-only не говорит ни с кем. Прежняя симуляция поджигала юниты
    // локации сама, без участия игрока, — в собранной игре так не было
    // никогда, и это ровно то расхождение, ради которого QA переехал на
    // настоящего режиссёра.
    expect(report.firedUnits).toEqual([]);
    // Отношения не двигаются: ни выборов, ни closing-гейнов не случилось.
    expect(report.relFinal.kira).toBeCloseTo(archetypeAffectionStart(SAMPLE_BRIEF, 'kira'));
  });

  it('финал, зависящий от юнита в непосещаемой локации, валит spine-only; summarize даёт error', () => {
    const spine = simSpine();
    spine.beats.find(b => b.id === 'fin')!.guard = guardFromRequires(['unit_flag']);
    // Флаг ставит только юнит в loc_z — spine-only туда не ходит.
    const units = [unit('u_secret', 'loc_z', { effects: [{ setFlag: 'unit_flag' }] })];
    const inputs = mkInputs(spine, units, { u_secret: fullProse() });

    const reports = simulatePolicies(inputs, ['spine-only']);
    expect(reports[0].reachedFinale).toBe(false);

    const summary = summarizePolicyReports(reports);
    expect(
      summary.some(i => i.severity === 'error' && i.scope === 'sim/spine-only' && i.message.includes('финала')),
    ).toBe(true);
  });

  it('greedy-li:* разворачивается в политику на каждого LI брифа', () => {
    const inputs = mkInputs(simSpine(), [], {});
    const reports = simulatePolicies(inputs, ['greedy-li:*']);
    // Каждая политика гоняется по набору seed-ов: селектор стохастичен, и
    // одиночный прогон мог бы случайно не заметить голодающий контент.
    expect([...new Set(reports.map(r => r.policy))]).toEqual(['greedy-li:kira', 'greedy-li:yuki', 'greedy-li:asel']);
    const seeds = [...new Set(reports.map(r => r.seed))];
    expect(seeds.length).toBeGreaterThan(1);
    expect(reports).toHaveLength(3 * seeds.length);
  });

  it('seeded-random детерминирован: два прогона дают идентичные отчёты', () => {
    const inputs = mkInputs(simSpine(), [unit('u1', 'loc_c'), unit('u2', 'loc_a')], {
      u1: fullProse(),
      u2: fullProse(),
    });
    const a = simulatePolicies(inputs, ['seeded-random:1', 'seeded-random:2']);
    const b = simulatePolicies(inputs, ['seeded-random:1', 'seeded-random:2']);
    expect(a).toEqual(b);
    // Обе оси различимы: и политика, и seed прогона.
    expect(new Set(a.map(r => r.policy))).toEqual(new Set(['seeded-random:1', 'seeded-random:2']));
    expect(new Set(a.map(r => r.seed)).size).toBeGreaterThan(1);
  });

  it('симуляция гоняет ТОТ ЖЕ режиссёр, что и игра: отчёт воспроизводим по seed', () => {
    // Смысл всего переезда D3: симулятор и движок больше не два исполнителя
    // одних правил. Одинаковые вход и seed обязаны давать посимвольно
    // одинаковый прогон — иначе «QA зелёный, а игра не проходится» вернётся.
    const inputs = mkInputs(simSpine(), [unit('u1', 'loc_c')], { u1: fullProse() });
    expect(simulatePolicies(inputs, ['warm-li:kira'])).toEqual(simulatePolicies(inputs, ['warm-li:kira']));
  });

  it('без модели мира симуляция не молчит, а докладывает ошибку', () => {
    // Пустой отчёт раньше читался бы как «всё хорошо» — самый опасный вид
    // зелёного: не проверено ничего.
    const blind = { ...mkInputs(simSpine(), []), worldModel: null };
    expect(simulatePolicies(blind)).toEqual([]);
    const errs = summarizePolicyReports([]).filter(i => i.severity === 'error');
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain('не запускалась');
  });

  it('контент, который селектор не предлагает, попадает в отчёт как голодающий', () => {
    // Сцена Асель, которой расписание не ставит НИ ОДНОГО слота на сцене:
    // проза оплачена, а встретить её негде. Локация при этом настоящая —
    // юнит в несуществующей локации компилятор отбрасывает раньше, это
    // другой сигнал (его ловит структурный D2).
    const units = [unit('u_seen', 'loc_c'), unit('u_never', 'loc_a', { participants: ['asel'] })];
    const inputs = mkInputs(simSpine(), units, { u_seen: fullProse(), u_never: fullProse() });
    const reports = simulatePolicies(inputs, ['warm-li:kira']);
    const starved = reports.find(r => r.starvedUnits)?.starvedUnits ?? [];
    expect(starved).toContain('u_never');
    expect(starved).not.toContain('u_seen');

    const warn = summarizePolicyReports(reports).filter(i => i.scope === 'sim/selector');
    expect(warn).toHaveLength(1);
    expect(warn[0].severity).toBe('warning');
  });

  it('концовка без выполнимого guard-а → endingSatisfied null + error в summary', () => {
    const spine = simSpine();
    spine.endings = [{ id: 'e_only', kind: 'normal', liId: null, guard: guardFromRequires(['never_set']) }];
    const reports = simulatePolicies(mkInputs(spine, []), ['spine-only']);
    expect(reports[0].endingSatisfied).toBeNull();
    const summary = summarizePolicyReports(reports);
    expect(summary.some(i => i.severity === 'error' && i.message.includes('концовка'))).toBe(true);
  });
});

describe('buildStoryLeafQARequests (D4)', () => {
  it('концовки листа фильтруются по достижимости: чужая ветка не попадает к критику', () => {
    const payloads = buildStoryLeafQARequests(mkInputs(simSpine(), []));
    expect(payloads).toHaveLength(2);
    const byLabel = Object.fromEntries(payloads.map(p => [p.leafLabel, p.endings.map(e => e.id)]));
    expect(byLabel['bp=o1']).toEqual(['e1']);
    expect(byLabel['bp=o2']).toEqual(['e2']);
  });

  it('лист без единой достижимой концовки деградирует в полный список (критик не слепнет)', () => {
    const spine = simSpine();
    spine.endings = [{ id: 'e_ghost', kind: 'normal', liId: null, guard: guardFromRequires(['never_set']) }];
    const payloads = buildStoryLeafQARequests(mkInputs(spine, []));
    expect(payloads[0].endings.map(e => e.id)).toEqual(['e_ghost']);
  });
});

describe('simulatePolicies: малая стрелка внутри слота', () => {
  const twoUnits = (
    phaseA?: { fromPhase: number; toPhase: number },
    phaseB?: { fromPhase: number; toPhase: number },
  ) => [
    unit('u_early', 'loc_a', {
      participants: ['kira'],
      at: { locationId: 'loc_a', slot: { fromSlot: 0, toSlot: 11 }, ...(phaseA ? { phase: phaseA } : {}) },
      effects: [],
    }),
    unit('u_second', 'loc_a', {
      participants: ['kira'],
      at: { locationId: 'loc_a', slot: { fromSlot: 0, toSlot: 11 }, ...(phaseB ? { phase: phaseB } : {}) },
      effects: [],
    }),
  ];
  const kiraAllDay: CharacterSchedule = { ...schedule, kira: new Array(12).fill('loc_a') };

  it('за один слот играется несколько разговоров — тариф «встреча = слот» отменён', () => {
    const [r] = simulatePolicies({ ...mkInputs(simSpine(), twoUnits()), schedule: kiraAllDay }, ['greedy-li:kira']);
    expect(r.firedUnits).toContain('u_early');
    expect(r.firedUnits).toContain('u_second');
    expect(r.actsPlayed).toBeGreaterThanOrEqual(2);
  });

  it('late-юнит не стреляет, пока фаза свежая: восприимчивость — свойство сцены', () => {
    // Один юнит в слоте открыт только поздно. Он обязан дождаться, пока фазу
    // потратит другой разговор, — иначе «подбодрить вымотанного» игралось бы
    // с порога, и смысл окна терялся.
    const last = PHASES_PER_SLOT - 1;
    const [r] = simulatePolicies(
      {
        ...mkInputs(simSpine(), twoUnits({ fromPhase: 0, toPhase: 0 }, { fromPhase: last, toPhase: last })),
        schedule: kiraAllDay,
      },
      ['greedy-li:kira'],
    );
    // Оба сыграли, но поздний — только после того, как ранний выжег фазу.
    expect(r.firedUnits).toContain('u_early');
    expect(r.firedUnits).toContain('u_second');
    expect(r.firedUnits.indexOf('u_early')).toBeLessThan(r.firedUnits.indexOf('u_second'));
  });

  it('late-юнит в одиночку недостижим: фазу сжечь нечем', () => {
    const last = PHASES_PER_SLOT - 1;
    const lateOnly = [
      unit('u_late', 'loc_a', {
        participants: ['kira'],
        at: { locationId: 'loc_a', slot: { fromSlot: 0, toSlot: 11 }, phase: { fromPhase: last, toPhase: last } },
        effects: [],
      }),
    ];
    const [r] = simulatePolicies({ ...mkInputs(simSpine(), lateOnly), schedule: kiraAllDay }, ['greedy-li:kira']);
    expect(r.firedUnits).not.toContain('u_late');
  });
});
