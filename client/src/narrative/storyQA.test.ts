import { describe, expect, it } from 'vitest';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { guardFromRequires } from './calendarTypes';
import type { DialogueUnit } from './dialogueUnit';
import type { DialogueVariantBracket, SegmentIssue } from './types';
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
  worldModel: null,
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
    expect(report.firedUnits).toContain('u2'); // u2 в loc_a срабатывает по пути
    expect(report.deadSlots).toEqual([]);
    expect(report.relFinal.kira).toBeCloseTo(0.2); // rel-эффект u2
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
    expect(reports.map(r => r.policy)).toEqual(['greedy-li:kira', 'greedy-li:yuki', 'greedy-li:asel']);
  });

  it('seeded-random детерминирован: два прогона дают идентичные отчёты', () => {
    const inputs = mkInputs(simSpine(), [unit('u1', 'loc_c'), unit('u2', 'loc_a')], {
      u1: fullProse(),
      u2: fullProse(),
    });
    const a = simulatePolicies(inputs, ['seeded-random:1', 'seeded-random:2']);
    const b = simulatePolicies(inputs, ['seeded-random:1', 'seeded-random:2']);
    expect(a).toEqual(b);
    // Разные seed-ы — это разные политики (не один и тот же прогон под двумя именами).
    expect(a[0].policy).not.toBe(a[1].policy);
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
