import { describe, expect, it } from 'vitest';
import {
  buildCommitPatch,
  cascadeDirtyFields,
  committedAllowed,
  effectiveMap,
  effectiveScalar,
  flattenSoftIssues,
  hasAnyDraft,
  matchPendingBatch,
  shouldReuseDraft,
  TOTAL_STEPS,
  type CalendarDraft,
  type CalendarRunState,
  type CommittedStack,
} from './calendarRunState';
import type { Brief } from './types';
import type { CastPlan, SpinePlan } from './calendarTypes';

const brief = (title: string): Brief => ({ world: { setting: { specifics: title } } } as unknown as Brief);
const castPlan = (id: string): CastPlan => ({ members: [{ id }] } as unknown as CastPlan);
const spine = (title: string): SpinePlan => ({ title, beats: [], endings: [] } as unknown as SpinePlan);

const emptyCommitted: CommittedStack = {
  castPlan: null,
  worldModel: null,
  calendar: null,
  tagMap: null,
  anchorNarrations: null,
  spine: null,
  schedule: null,
  eventUnits: {},
  unitProse: {},
  spineBeatProse: {},
  endings: {},
};

const runState = (patch: Partial<CalendarRunState> = {}): CalendarRunState => ({
  status: 'running',
  force: false,
  phase: 'cast',
  progress: { completed: 0, total: TOTAL_STEPS },
  error: null,
  issues: [],
  softIssues: {},
  brief: brief('a'),
  dirtyStages: [],
  draft: {},
  pendingBatch: null,
  startedAt: 0,
  runId: 'run-1',
  ...patch,
});

describe('cascadeDirtyFields', () => {
  it('повторяет каскады бывших сеттеров стора', () => {
    // setCastPlan сносил calendar/tagMap + всё от spine вниз + endings, но НЕ worldModel.
    const cast = cascadeDirtyFields(['cast']);
    expect(cast.has('calendar')).toBe(true);
    expect(cast.has('tagMap')).toBe(true);
    expect(cast.has('endings')).toBe(true);
    expect(cast.has('worldModel')).toBe(false);
    expect(cast.has('castPlan')).toBe(false);

    // setSpine не трогал calendar.
    const sp = cascadeDirtyFields(['spine']);
    expect(sp.has('calendar')).toBe(false);
    expect(sp.has('schedule')).toBe(true);
    expect(sp.has('unitProse')).toBe(true);

    // setSchedule сносил только пул и его прозу.
    expect([...cascadeDirtyFields(['schedule'])].sort()).toEqual(['eventUnits', 'unitProse']);
  });

  it('объединяет каскады нескольких стадий', () => {
    const dirty = cascadeDirtyFields(['schedule', 'world_calendar']);
    expect(dirty.has('spine')).toBe(true);
    expect(dirty.has('eventUnits')).toBe(true);
  });
});

describe('committedAllowed', () => {
  it('force запрещает committed-кэш целиком', () => {
    expect(committedAllowed('spine', true, [])).toBe(false);
    expect(committedAllowed('spine', false, [])).toBe(true);
  });

  it('грязная стадия запрещает committed-кэш нижележащих полей', () => {
    expect(committedAllowed('spine', false, ['world_calendar'])).toBe(false);
    expect(committedAllowed('calendar', false, ['spine'])).toBe(true);
  });
});

describe('effectiveScalar', () => {
  const committed: CommittedStack = { ...emptyCommitted, spine: spine('committed'), castPlan: castPlan('kira') };

  it('draft важнее committed', () => {
    const draft: CalendarDraft = { spine: spine('draft') };
    expect(effectiveScalar('spine', draft, committed, false, [])).toEqual({
      value: draft.spine,
      source: 'draft',
    });
  });

  it('committed доступен, пока не запрещён', () => {
    expect(effectiveScalar('spine', {}, committed, false, [])).toEqual({
      value: committed.spine,
      source: 'committed',
    });
    expect(effectiveScalar('spine', {}, committed, true, [])).toEqual({ value: null, source: 'none' });
    expect(effectiveScalar('spine', {}, committed, false, ['cast'])).toEqual({ value: null, source: 'none' });
  });

  it('пустой committed даёт source none', () => {
    expect(effectiveScalar('spine', {}, emptyCommitted, false, [])).toEqual({ value: null, source: 'none' });
  });
});

describe('effectiveMap', () => {
  const committed: CommittedStack = {
    ...emptyCommitted,
    spineBeatProse: {
      b1: { beatText: 'committed' },
      b2: { beatText: 'committed' },
    } as unknown as CommittedStack['spineBeatProse'],
  };
  const draft: CalendarDraft = {
    spineBeatProse: { b2: { beatText: 'draft' } } as unknown as CalendarDraft['spineBeatProse'],
  };

  it('мержит committed под draft и помечает draft-ключи', () => {
    const { value, draftKeys } = effectiveMap('spineBeatProse', draft, committed, false, []);
    expect(Object.keys(value).sort()).toEqual(['b1', 'b2']);
    expect(value.b2.beatText).toBe('draft');
    expect([...draftKeys]).toEqual(['b2']);
  });

  it('при force/грязном каскаде committed не подмешивается', () => {
    expect(Object.keys(effectiveMap('spineBeatProse', draft, committed, true, []).value)).toEqual(['b2']);
    expect(Object.keys(effectiveMap('spineBeatProse', draft, committed, false, ['spine']).value)).toEqual(['b2']);
  });
});

describe('shouldReuseDraft', () => {
  it('продолжает прогон при совпадении брифа и режима', () => {
    expect(shouldReuseDraft(runState(), brief('a'), false)).toBe(true);
  });

  it('не продолжает при смене брифа, режима force или после done', () => {
    expect(shouldReuseDraft(runState(), brief('b'), false)).toBe(false);
    expect(shouldReuseDraft(runState(), brief('a'), true)).toBe(false);
    expect(shouldReuseDraft(runState({ status: 'done' }), brief('a'), false)).toBe(false);
    expect(shouldReuseDraft(null, brief('a'), false)).toBe(false);
  });

  it('упавший прогон продолжается (кнопка «Продолжить»)', () => {
    expect(shouldReuseDraft(runState({ status: 'error' }), brief('a'), false)).toBe(true);
  });
});

describe('matchPendingBatch', () => {
  it('различает parse-контексты одного брекета', () => {
    const pending = { phase: 'dialogue_units' as const, itemKey: 'enc_kira/positive', batchId: 'b1' };
    expect(matchPendingBatch(pending, 'dialogue_units', 'enc_kira/positive')).toBe(true);
    expect(matchPendingBatch(pending, 'dialogue_units', 'enc_kira/positive/qa')).toBe(false);
    expect(matchPendingBatch(pending, 'spine', null)).toBe(false);
    expect(matchPendingBatch(null, 'spine', null)).toBe(false);
  });
});

describe('buildCommitPatch', () => {
  it('заменяет стек черновиком целиком и закрывает прогон', () => {
    const run = runState({
      draft: { castPlan: castPlan('kira'), spine: spine('draft'), endings: {} },
      softIssues: { cast: ['[warning] cast: стаб'], prune: ['[warning] prune: 2 юнита'] },
      pendingBatch: { phase: 'spine', itemKey: null, batchId: 'b1' },
      error: 'старая ошибка',
    });
    const patch = buildCommitPatch(run);

    expect(patch.castPlan).toBe(run.draft.castPlan);
    expect(patch.spine).toBe(run.draft.spine);
    // Поля, которых в черновике нет, обнуляются — осиротевшие ключи не выживают.
    expect(patch.worldModel).toBeNull();
    expect(patch.unitProse).toEqual({});
    expect(patch.calendarRun.status).toBe('done');
    expect(patch.calendarRun.phase).toBe('done');
    expect(patch.calendarRun.progress).toEqual({ completed: TOTAL_STEPS, total: TOTAL_STEPS });
    expect(patch.calendarRun.error).toBeNull();
    expect(patch.calendarRun.issues).toEqual(['[warning] cast: стаб', '[warning] prune: 2 юнита']);
    expect(patch.calendarRun.draft).toEqual({});
    expect(patch.calendarRun.pendingBatch).toBeNull();
  });
});

describe('flattenSoftIssues / hasAnyDraft', () => {
  it('flattenSoftIssues склеивает стадии', () => {
    expect(flattenSoftIssues({ cast: ['a'], prune: ['b', 'c'] })).toEqual(['a', 'b', 'c']);
  });

  it('hasAnyDraft отличает пустой черновик от заполненного', () => {
    expect(hasAnyDraft(undefined)).toBe(false);
    expect(hasAnyDraft({})).toBe(false);
    expect(hasAnyDraft({ eventUnits: {} })).toBe(false);
    expect(hasAnyDraft({ castPlan: castPlan('kira') })).toBe(true);
    expect(hasAnyDraft({ spineBeatProse: { b1: {} as never } })).toBe(true);
  });
});
