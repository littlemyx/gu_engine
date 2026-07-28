import { describe, expect, it } from 'vitest';

import { deriveHierarchy } from './hierarchyModel';
import { deriveStructure } from './structureModel';

import type { Calendar, SpinePlan } from '@/narrative/calendarTypes';
import type { Brief, SegmentIssue } from '@/narrative/types';

const calendar: Calendar = { days: 3, dayparts: ['утро', 'день', 'вечер'], slotCount: 9, actBoundaries: [0, 1, 2] };

const brief = { loveInterests: [{ id: 'kira', name: 'Кира' }] } as unknown as Brief;

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

const base = { brief, spine, calendar, eventUnits: {}, unitProse: {}, spineBeatProse: {} };

describe('структура истории', () => {
  it('строит то же дерево, что и общая иерархия', () => {
    const structure = deriveStructure(base);
    const hierarchy = deriveHierarchy({ ...base, issues: [], runPhase: null, audio: null });

    expect(structure.map(n => n.key)).toEqual(hierarchy.map(n => n.key));
  });

  // Производственные поля типом в структуру не пролезают — в том и смысл
  // разделения. Здесь они подсовываются насильно, чтобы доказать: даже если
  // кто-то их передаст, на дерево они не повлияют.
  const withProduction = (extra: Record<string, unknown>) =>
    deriveStructure({ ...base, ...extra } as unknown as Parameters<typeof deriveStructure>[0]);

  it('производственных состояний в структуре нет', () => {
    const issues: SegmentIssue[] = [{ scope: 'spine/beats/b1/summary', message: 'пусто' } as SegmentIssue];

    const structure = withProduction({ issues });
    const states = structure.map(n => String(n.state));

    expect(states).not.toContain('failed');
    expect(states).not.toContain('running');
  });

  it('сбои и фаза прогона не меняют дерева: это ведомость, а не структура', () => {
    const clean = deriveStructure(base);
    const noisy = withProduction({ issues: [{ scope: 'spine/beats/b1' }], runPhase: 'spine' });

    expect(noisy).toEqual(clean);
  });

  it('приглушённые строки остаются приглушёнными — это нарративное состояние', () => {
    const structure = deriveStructure(base);
    const states = new Set(structure.map(n => n.state));

    for (const state of states) expect(['normal', 'selected', 'dim']).toContain(state);
  });

  it('на пустой истории дерево не падает', () => {
    expect(() =>
      deriveStructure({ brief, spine: null, calendar: null, eventUnits: {}, unitProse: {}, spineBeatProse: {} }),
    ).not.toThrow();
  });
});
