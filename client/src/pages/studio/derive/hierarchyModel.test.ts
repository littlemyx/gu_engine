import { describe, expect, it } from 'vitest';

import { deriveHierarchy } from './hierarchyModel';

import type { Calendar, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit } from '@/narrative/dialogueUnit';
import type { Brief, SegmentIssue } from '@/narrative/types';

const calendar: Calendar = {
  days: 3,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 9,
  actBoundaries: [0, 1, 2],
};

const brief = (...names: string[]): Brief =>
  ({
    loveInterests: names.map(name => ({ id: name.toLowerCase(), name })),
  } as unknown as Brief);

const spine: SpinePlan = {
  title: 'Лето на Взморье',
  logline: '—',
  beats: [
    {
      id: 'b1',
      kind: 'beat',
      act: 0,
      window: { fromSlot: 0, toSlot: 2 },
      locationId: 'loc_cafe',
      participants: ['kira'],
      summary: 'Знакомство',
      establishes: [],
      guard: { all: [] },
    },
  ],
  endings: [],
};

const unit = (id: string, charId: string, arcStage?: number): EventUnit =>
  ({
    id,
    kind: 'dialogue',
    at: {},
    participants: [charId],
    guard: { all: [] },
    effects: [],
    priority: 0,
    goal: '',
    arcStage,
    source: 'agenda',
  } as EventUnit);

const dialogue = (id: string): DialogueUnit[] =>
  [{ id, liId: 'kira', bracket: 'neutral', entryNodeId: 'n1', nodes: [] }] as unknown as DialogueUnit[];

describe('deriveHierarchy', () => {
  it('строит дерево история → бит → персонаж → группа → юнит', () => {
    const nodes = deriveHierarchy({
      brief: brief('Кира'),
      spine,
      calendar,
      eventUnits: { u1: unit('u1', 'кира', 2) },
      unitProse: {},
      spineBeatProse: {},
    });

    expect(nodes.map(n => n.depth)).toEqual([0, 1, 1, 2, 3]);
    expect(nodes[0].label).toBe('Лето на Взморье');
    expect(nodes[1].selection).toEqual({ kind: 'beat', id: 'b1' });
    expect(nodes[3].label).toBe('Ступень 2');
    expect(nodes[4].selection).toEqual({ kind: 'unit', unitId: 'u1' });
  });

  it('юнит без прозы приглушён, с прозой — обычный', () => {
    const nodes = deriveHierarchy({
      brief: brief('Кира'),
      spine: null,
      calendar: null,
      eventUnits: { u1: unit('u1', 'кира'), u2: unit('u2', 'кира') },
      unitProse: { u1: dialogue('u1') },
      spineBeatProse: {},
    });

    const byKey = Object.fromEntries(nodes.map(n => [n.key, n]));
    expect(byKey['unit:u1'].state).toBe('normal');
    expect(byKey['unit:u2'].state).toBe('dim');
    expect(byKey['char:кира'].meta).toBe('1/2');
  });

  it('ошибка QA помечает бит и персонажа как сбойные', () => {
    const issues: SegmentIssue[] = [
      { severity: 'error', scope: 'spine/beats/b1/window', message: 'окно вне акта' },
      { severity: 'error', scope: 'dialogue/u1/nodes', message: 'битая ссылка' },
    ];
    const nodes = deriveHierarchy({
      brief: brief('Кира'),
      spine,
      calendar,
      eventUnits: { u1: unit('u1', 'кира') },
      unitProse: {},
      spineBeatProse: {},
      issues,
    });

    const byKey = Object.fromEntries(nodes.map(n => [n.key, n]));
    expect(byKey['beat:b1'].state).toBe('failed');
    expect(byKey['unit:u1'].state).toBe('failed');
    expect(byKey['char:кира'].state).toBe('failed');
  });

  it('предупреждения сбоем не считаются', () => {
    const nodes = deriveHierarchy({
      brief: brief('Кира'),
      spine,
      calendar,
      eventUnits: {},
      unitProse: {},
      spineBeatProse: { b1: { anchorId: 'b1', beatText: 'т', transitions: [] } },
      issues: [{ severity: 'warning', scope: 'spine/beats/b1/requires', message: 'мягкое' }],
    });

    expect(nodes.find(n => n.key === 'beat:b1')?.state).toBe('normal');
  });
});
