import type { Node, Edge } from '@xyflow/react';
import type { AnchorPlan, GeneratedSegment, OutlinePlan } from '@/narrative';

export type AnchorNodeData = AnchorPlan & {
  routeColor: string;
};

const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 200;

/** Палитра для маршрутов в порядке появления (помимо common). */
const ROUTE_PALETTE = [
  '#8b5cf6', // violet — kira
  '#0ea5e9', // sky — yuki
  '#ec4899', // pink — asel
  '#f97316', // orange
  '#22c55e', // green
];
const COMMON_COLOR = '#fbbf24'; // amber для common-route

/**
 * Топологическое раскладывание якорей по сетке (depth × route).
 *
 *   x = depth   — длиннейший путь от любого корня до этого узла
 *   y = индекс маршрута (common всегда сверху)
 *
 * Получаем читаемую компоновку: common-route одной горизонтальной линией
 * сверху, после common_climax расходимся вниз на параллельные маршруты LI.
 */
export function computeAnchorLayout(
  outline: OutlinePlan,
  segments: Record<string, GeneratedSegment> = {},
): {
  nodes: Node<AnchorNodeData>[];
  edges: Edge[];
} {
  const anchorById = new Map<string, AnchorPlan>();
  for (const a of outline.anchors) anchorById.set(a.id, a);

  // Топологическая глубина: наибольшее число шагов от любого корня.
  const incoming = new Map<string, string[]>();
  for (const a of outline.anchors) incoming.set(a.id, []);
  for (const e of outline.anchorEdges) {
    if (incoming.has(e.to)) incoming.get(e.to)!.push(e.from);
  }

  const depth = new Map<string, number>();
  const computeDepth = (id: string, stack = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (stack.has(id)) return 0; // защита от циклов (на DAG не должно случаться)
    stack.add(id);
    const preds = incoming.get(id) ?? [];
    const d = preds.length === 0 ? 0 : 1 + Math.max(...preds.map(p => computeDepth(p, stack)));
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const a of outline.anchors) computeDepth(a.id);

  // Список маршрутов: common первым, остальные в порядке первого появления.
  const routesOrdered: string[] = [];
  for (const a of outline.anchors) {
    if (!routesOrdered.includes(a.routeId)) routesOrdered.push(a.routeId);
  }
  routesOrdered.sort((a, b) => {
    if (a === 'common') return -1;
    if (b === 'common') return 1;
    return 0; // сохраняем порядок первого появления
  });
  const routeIndex = new Map(routesOrdered.map((r, i) => [r, i]));
  const routeColor = (route: string) => {
    if (route === 'common') return COMMON_COLOR;
    const idx = routeIndex.get(route)! - 1; // -1 because common is at 0
    return ROUTE_PALETTE[idx % ROUTE_PALETTE.length];
  };

  // Внутри одного слоя (depth) могут оказаться несколько узлов одного маршрута;
  // разнесём их подсмещением по x, чтобы рёбра не наезжали.
  const slotByDepthRoute = new Map<string, number>();
  const nodes: Node<AnchorNodeData>[] = outline.anchors.map(anchor => {
    const baseDepth = depth.get(anchor.id) ?? 0;
    const key = `${baseDepth}|${anchor.routeId}`;
    const slot = slotByDepthRoute.get(key) ?? 0;
    slotByDepthRoute.set(key, slot + 1);

    const x = (baseDepth + slot * 0) * COLUMN_WIDTH; // одна позиция на слой обычно
    const y = (routeIndex.get(anchor.routeId) ?? 0) * ROW_HEIGHT;

    return {
      id: anchor.id,
      type: 'anchor',
      position: { x, y },
      data: { ...anchor, routeColor: routeColor(anchor.routeId) },
      // visually grouping by routeId via parentNode — пока не используем,
      // достаточно разноса по y и цвета бордера.
      draggable: true,
    };
  });

  const edges: Edge[] = outline.anchorEdges.map((e, i) => {
    const targetAnchor = anchorById.get(e.to);
    const hasSegment = !!segments[`${e.from}->${e.to}`];
    const stroke = targetAnchor ? routeColor(targetAnchor.routeId) : '#9ca3af';
    return {
      id: `e-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: false,
      // Сгенерированные сегменты — толстая сплошная линия;
      // несгенерированные — тонкая пунктирная (placeholder).
      style: hasSegment
        ? { stroke, strokeWidth: 2.5 }
        : { stroke, strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.6 },
      label: hasSegment ? '✓' : undefined,
      labelStyle: hasSegment ? { fill: stroke, fontWeight: 700 } : undefined,
      labelBgStyle: hasSegment ? { fill: '#fff', fillOpacity: 0.9 } : undefined,
    };
  });

  return { nodes, edges };
}
