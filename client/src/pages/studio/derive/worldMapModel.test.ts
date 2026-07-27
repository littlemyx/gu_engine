import { describe, expect, it } from 'vitest';

import { deriveWorldMap, WORLD_NODE_WIDTH } from './worldMapModel';

import type { Calendar, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { ImageGenState } from '@/narrative/narrativeStore';
import type { WorldModel } from '@/narrative/types';

const calendar: Calendar = {
  days: 2,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 6,
  actBoundaries: [0, 1],
};

const worldModel = {
  locations: [
    {
      id: 'loc_cafe',
      name: 'кафе Прибой',
      description: '',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'loc_park', via: 'через набережную' }],
      mood: 'neutral_calm',
      specialKind: null,
    },
    {
      id: 'loc_park',
      name: 'парк',
      description: '',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'loc_cafe', via: 'через набережную' }],
      mood: 'neutral_calm',
      specialKind: null,
    },
    {
      id: 'loc_attic',
      name: 'чердак',
      description: '',
      pointsOfInterest: [],
      adjacent: [],
      mood: 'neutral_calm',
      specialKind: null,
    },
  ],
  anchorLocations: {},
} as unknown as WorldModel;

const spine: SpinePlan = {
  title: 'Лето',
  logline: '—',
  beats: [
    {
      id: 'b1',
      kind: 'beat',
      act: 0,
      window: { fromSlot: 0, toSlot: 1 },
      locationId: 'loc_cafe',
      participants: [],
      summary: 'Знакомство',
      establishes: [],
      guard: { all: [] },
    },
  ],
  endings: [],
};

const unit: EventUnit = {
  id: 'u1',
  kind: 'dialogue',
  at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'loc_park' },
  participants: ['kira'],
  guard: { all: [] },
  effects: [],
  priority: 0,
  goal: '',
  source: 'agenda',
} as EventUnit;

const images: Record<string, ImageGenState> = {
  'loc:loc_cafe': { status: 'done', filename: 'cafe.png' },
};

describe('deriveWorldMap', () => {
  it('без модели мира карта пустая', () => {
    const model = deriveWorldMap({
      worldModel: null,
      spine,
      calendar,
      eventUnits: {},
      images: {},
    });

    expect(model).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('двусторонняя связность даёт одно ребро, а не два', () => {
    const model = deriveWorldMap({ worldModel, spine, calendar, eventUnits: {}, images: {} });

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ from: 'loc_cafe', to: 'loc_park', via: 'через набережную' });
  });

  it('считает сцены и фон локации', () => {
    const model = deriveWorldMap({ worldModel, spine, calendar, eventUnits: { u1: unit }, images });
    const byId = Object.fromEntries(model.nodes.map(n => [n.id, n]));

    expect(byId.loc_cafe).toMatchObject({ beatCount: 1, unitCount: 0, hasBackground: true, state: 'normal' });
    expect(byId.loc_park).toMatchObject({ beatCount: 0, unitCount: 1, hasBackground: false, state: 'normal' });
  });

  it('локация без переходов помечена недостижимой, пустая — empty', () => {
    const model = deriveWorldMap({ worldModel, spine, calendar, eventUnits: {}, images: {} });
    const byId = Object.fromEntries(model.nodes.map(n => [n.id, n]));

    expect(byId.loc_attic.state).toBe('unreachable');
    expect(byId.loc_park.state).toBe('empty');
  });

  it('раскладка укладывается в объявленный холст', () => {
    const model = deriveWorldMap({ worldModel, spine, calendar, eventUnits: {}, images: {} });

    expect(model.width).toBeGreaterThanOrEqual(WORLD_NODE_WIDTH);
    for (const node of model.nodes) {
      expect(node.x + WORLD_NODE_WIDTH).toBeLessThanOrEqual(model.width);
      expect(node.x).toBeGreaterThanOrEqual(0);
    }
  });
});
