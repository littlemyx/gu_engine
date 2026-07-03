import type { WorldLocation, WorldModel } from './types';

/** Максимум узлов маршрута в промпте: from + ≤2 промежуточных + to. */
const ROUTE_NODE_CAP = 4;

/** Шаг маршрута для промпта паутины. */
export type RouteStep = {
  locationId: string;
  name: string;
  /** Как игрок попадает СЮДА из предыдущего шага (для первого шага — ''). */
  via: string;
};

function byId(world: WorldModel): Map<string, WorldLocation> {
  return new Map(world.locations.map(l => [l.id, l]));
}

/**
 * BFS-путь между локациями двух якорей по adjacency (неориентированной).
 * Возвращает последовательность шагов от локации from-якоря до локации
 * to-якоря включительно; null — если пути нет или якоря не замаплены.
 * Длинные пути обрезаются до ROUTE_NODE_CAP (from + начало + to).
 */
export function locationRoute(world: WorldModel, fromAnchorId: string, toAnchorId: string): RouteStep[] | null {
  const locs = byId(world);
  const fromId = world.anchorLocations[fromAnchorId];
  const toId = world.anchorLocations[toAnchorId];
  if (!fromId || !toId || !locs.has(fromId) || !locs.has(toId)) return null;

  const mkStep = (locationId: string, via: string): RouteStep => ({
    locationId,
    name: locs.get(locationId)?.name ?? locationId,
    via,
  });

  if (fromId === toId) return [mkStep(fromId, '')];

  // Неориентированные соседи + подпись via для каждой пары.
  const neighbors = new Map<string, { id: string; via: string }[]>();
  const addEdge = (a: string, b: string, via: string) => {
    if (!neighbors.has(a)) neighbors.set(a, []);
    if (!neighbors.get(a)!.some(n => n.id === b)) neighbors.get(a)!.push({ id: b, via });
  };
  for (const l of world.locations) {
    for (const adj of l.adjacent) {
      if (!locs.has(adj.locationId)) continue;
      addEdge(l.id, adj.locationId, adj.via);
      addEdge(adj.locationId, l.id, adj.via);
    }
  }

  // BFS с восстановлением пути.
  const prev = new Map<string, { id: string; via: string }>();
  const queue = [fromId];
  const visited = new Set([fromId]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === toId) break;
    for (const n of neighbors.get(cur) ?? []) {
      if (visited.has(n.id)) continue;
      visited.add(n.id);
      prev.set(n.id, { id: cur, via: n.via });
      queue.push(n.id);
    }
  }
  if (!visited.has(toId)) return null;

  const path: RouteStep[] = [];
  let cur = toId;
  while (cur !== fromId) {
    const p = prev.get(cur)!;
    path.unshift(mkStep(cur, p.via));
    cur = p.id;
  }
  path.unshift(mkStep(fromId, ''));

  // Обрезка: from + первые промежуточные + to.
  if (path.length > ROUTE_NODE_CAP) {
    const trimmed = [...path.slice(0, ROUTE_NODE_CAP - 1), path[path.length - 1]];
    // via последнего шага после обрезки неточен — обобщаем.
    trimmed[trimmed.length - 1] = { ...trimmed[trimmed.length - 1], via: 'дальше по пути' };
    return trimmed;
  }
  return path;
}
