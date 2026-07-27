import { describe, expect, it } from 'vitest';

import { deriveBlueprint } from './blueprintModel';

import type { Calendar, SpineBeat, SpinePlan } from '@/narrative/calendarTypes';
import type { AnchorBeat, SegmentIssue } from '@/narrative/types';

const calendar: Calendar = {
  days: 3,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 9,
  actBoundaries: [0, 1, 2],
};

const beat = (patch: Partial<SpineBeat> & { id: string }): SpineBeat => ({
  kind: 'beat',
  act: 0,
  window: { fromSlot: 0, toSlot: 8 },
  locationId: 'loc_cafe',
  participants: ['kira'],
  summary: patch.id,
  establishes: [],
  guard: { all: [] },
  ...patch,
});

const spineOf = (beats: SpineBeat[]): SpinePlan => ({
  title: 'Лето',
  logline: '—',
  beats,
  endings: [],
});

const prose = (...ids: string[]): Record<string, AnchorBeat> =>
  Object.fromEntries(ids.map(id => [id, { anchorId: id, beatText: 'текст', transitions: [] }]));

describe('deriveBlueprint', () => {
  it('состояние done только у битов с прозой, остальные — failed', () => {
    const spine = spineOf([beat({ id: 'b1' }), beat({ id: 'b2' })]);
    const model = deriveBlueprint({
      spine,
      calendar,
      spineBeatProse: prose('b1'),
      liIds: ['kira'],
    });

    expect(model.nodes.find(n => n.id === 'b1')?.state).toBe('done');
    expect(model.nodes.find(n => n.id === 'b2')?.state).toBe('failed');
  });

  it('во время стадии beat_prose бит без прозы показывается как running', () => {
    const model = deriveBlueprint({
      spine: spineOf([beat({ id: 'b1' })]),
      calendar,
      spineBeatProse: {},
      liIds: ['kira'],
      runPhase: 'beat_prose',
    });

    expect(model.nodes[0].state).toBe('running');
  });

  it('бит недостижимой ветки гаснет и запирается', () => {
    const spine = spineOf([
      beat({
        id: 'bp',
        kind: 'branchPoint',
        outcomes: [
          { id: 'o1', label: 'остаться', setsFlag: 'stay', summary: '' },
          { id: 'o2', label: 'уйти', setsFlag: 'leave', summary: '' },
        ],
      }),
      beat({ id: 'b_stay', guard: { all: [{ flag: 'stay' }] } }),
      beat({ id: 'b_leave', guard: { all: [{ flag: 'leave' }] } }),
    ]);

    const model = deriveBlueprint({
      spine,
      calendar,
      spineBeatProse: {},
      liIds: ['kira'],
      branchAssignment: { bp: 'o1' },
    });

    expect(model.nodes.find(n => n.id === 'b_stay')?.dimmed).toBe(false);
    const leave = model.nodes.find(n => n.id === 'b_leave');
    expect(leave?.dimmed).toBe(true);
    expect(leave?.state).toBe('locked');
  });

  it('исход развилки даёт пунктирное ребро с подписью выбора', () => {
    const spine = spineOf([
      beat({
        id: 'bp',
        kind: 'branchPoint',
        outcomes: [{ id: 'o1', label: 'остаться', setsFlag: 'stay', summary: '' }],
      }),
      beat({ id: 'b_stay', guard: { all: [{ flag: 'stay' }] } }),
    ]);

    const model = deriveBlueprint({ spine, calendar, spineBeatProse: {}, liIds: ['kira'] });
    const branchEdge = model.edges.find(e => e.branch);

    expect(branchEdge).toMatchObject({ from: 'bp', to: 'b_stay', label: 'остаться' });
  });

  it('ошибка QA по биту переводит его в failed даже при наличии прозы', () => {
    const issues: SegmentIssue[] = [{ severity: 'error', scope: 'spine/beats/b1/window', message: 'окно вне акта' }];
    const model = deriveBlueprint({
      spine: spineOf([beat({ id: 'b1' })]),
      calendar,
      spineBeatProse: prose('b1'),
      liIds: ['kira'],
      issues,
    });

    expect(model.nodes[0].state).toBe('failed');
    expect(model.nodes[0].issues).toHaveLength(1);
  });

  it('биты одного слота делят колонку, разные слоты идут по порядку', () => {
    const spine = spineOf([
      beat({ id: 'late', window: { fromSlot: 6, toSlot: 8 } }),
      beat({ id: 'early', window: { fromSlot: 0, toSlot: 1 } }),
    ]);
    const model = deriveBlueprint({ spine, calendar, spineBeatProse: {}, liIds: ['kira'] });

    const early = model.nodes.find(n => n.id === 'early');
    const late = model.nodes.find(n => n.id === 'late');
    expect(early!.slot!).toBeLessThan(late!.slot!);
    expect(early!.column).toBeLessThan(late!.column);
  });
});
