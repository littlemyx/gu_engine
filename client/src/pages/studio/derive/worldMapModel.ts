import dagre from '@dagrejs/dagre';

import { assignBeatSlots } from '@/narrative/beatSchedule';
import { locationAmbientLabel, shorten } from '@/narrative/sliceModel';

import type { Calendar, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { ImageGenState } from '@/narrative/narrativeStore';
import type { WorldModel } from '@/narrative/types';

/**
 * «Карта мира»: реестр локаций и разрешённые переходы между ними. Раскладка
 * считается dagre-ом один раз на модель — узлы не таскаются мышью, карта
 * читается, а правки идут через инспектор локации.
 */

export type WorldMapNodeState = 'normal' | 'empty' | 'unreachable';

export type WorldMapNode = {
  id: string;
  name: string;
  short: string;
  /** «весёлая · клуб» или null. */
  ambientLabel: string | null;
  x: number;
  y: number;
  beatCount: number;
  unitCount: number;
  hasBackground: boolean;
  state: WorldMapNodeState;
};

export type WorldMapEdge = {
  from: string;
  to: string;
  /** Как добраться — подпись ребра из WorldLocation.adjacent. */
  via: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type WorldMapModel = {
  nodes: WorldMapNode[];
  edges: WorldMapEdge[];
  width: number;
  height: number;
};

export type WorldMapInputs = {
  worldModel: WorldModel | null;
  spine: SpinePlan | null;
  calendar: Calendar | null;
  eventUnits: Record<string, EventUnit>;
  images: Record<string, ImageGenState>;
};

export const WORLD_NODE_WIDTH = 150;
export const WORLD_NODE_HEIGHT = 56;
const NODESEP = 34;
const RANKSEP = 64;
const PADDING = 28;

export function deriveWorldMap(inputs: WorldMapInputs): WorldMapModel {
  const { worldModel, spine, calendar, eventUnits, images } = inputs;
  if (!worldModel || worldModel.locations.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const known = new Set(worldModel.locations.map(l => l.id));

  // ── Что происходит в локации ─────────────────────────────────────────────
  const beatCount = new Map<string, number>();
  if (spine && calendar) {
    const slots = assignBeatSlots(spine, calendar);
    for (const beat of spine.beats) {
      if (slots[beat.id] == null) continue;
      beatCount.set(beat.locationId, (beatCount.get(beat.locationId) ?? 0) + 1);
    }
  }
  const unitCount = new Map<string, number>();
  for (const unit of Object.values(eventUnits)) {
    const id = unit.at.locationId;
    if (!id) continue;
    unitCount.set(id, (unitCount.get(id) ?? 0) + 1);
  }

  // ── Раскладка ────────────────────────────────────────────────────────────
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: NODESEP, ranksep: RANKSEP, marginx: PADDING, marginy: PADDING });

  for (const location of worldModel.locations) {
    graph.setNode(location.id, { width: WORLD_NODE_WIDTH, height: WORLD_NODE_HEIGHT });
  }

  // Связность мира двусторонняя, но ребро в раскладке нужно одно: пара
  // (a,b) и (b,a) в dagre дала бы два параллельных ранга.
  const seen = new Set<string>();
  const pairs: Array<{ from: string; to: string; via: string }> = [];
  for (const location of worldModel.locations) {
    for (const adjacent of location.adjacent) {
      if (!known.has(adjacent.locationId)) continue;
      const key =
        location.id < adjacent.locationId
          ? `${location.id}|${adjacent.locationId}`
          : `${adjacent.locationId}|${location.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ from: location.id, to: adjacent.locationId, via: adjacent.via });
      graph.setEdge(location.id, adjacent.locationId);
    }
  }

  dagre.layout(graph);

  const nodes: WorldMapNode[] = worldModel.locations.map(location => {
    const laid = graph.node(location.id);
    const beats = beatCount.get(location.id) ?? 0;
    const units = unitCount.get(location.id) ?? 0;
    const connected = pairs.some(p => p.from === location.id || p.to === location.id);
    return {
      id: location.id,
      name: location.name || location.id,
      short: shorten(location.name || location.id, 14),
      ambientLabel: locationAmbientLabel(location),
      x: (laid?.x ?? 0) - WORLD_NODE_WIDTH / 2,
      y: (laid?.y ?? 0) - WORLD_NODE_HEIGHT / 2,
      beatCount: beats,
      unitCount: units,
      hasBackground: images[`loc:${location.id}`]?.status === 'done',
      // Локация без соседей недостижима буквально: игрок туда не дойдёт,
      // сколько бы событий ей ни назначили.
      state: !connected ? 'unreachable' : beats + units === 0 ? 'empty' : 'normal',
    };
  });

  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges: WorldMapEdge[] = pairs.flatMap(pair => {
    const from = byId.get(pair.from);
    const to = byId.get(pair.to);
    if (!from || !to) return [];
    return [
      {
        ...pair,
        x1: from.x + WORLD_NODE_WIDTH / 2,
        y1: from.y + WORLD_NODE_HEIGHT / 2,
        x2: to.x + WORLD_NODE_WIDTH / 2,
        y2: to.y + WORLD_NODE_HEIGHT / 2,
      },
    ];
  });

  const width = Math.max(...nodes.map(n => n.x + WORLD_NODE_WIDTH), 0) + PADDING;
  const height = Math.max(...nodes.map(n => n.y + WORLD_NODE_HEIGHT), 0) + PADDING;

  return { nodes, edges, width, height };
}
