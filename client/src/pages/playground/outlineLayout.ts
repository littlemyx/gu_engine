import type { Node, Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type {
  AnchorPlan,
  CharacterGenState,
  GeneratedSegment,
  ImageGenState,
  OutlinePlan,
  SegmentIssue,
} from '@/narrative';

const IMAGE_SERVER_BASE = 'http://localhost:3007';

export type AnchorNodeData = AnchorPlan & {
  routeColor: string;
  /** URL фона якоря (из image_gen). null если ещё не сгенерирован. */
  imageUrl: string | null;
  /** URL спрайта characterFocus-персонажа. null если фокуса нет или спрайт не готов. */
  spriteUrl: string | null;
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 280;
const NODESEP = 50;
const RANKSEP = 120;

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
  validations: Record<string, SegmentIssue[]> = {},
  images: Record<string, ImageGenState> = {},
  characters: Record<string, CharacterGenState> = {},
): {
  nodes: Node<AnchorNodeData>[];
  edges: Edge[];
} {
  const anchorById = new Map<string, AnchorPlan>();
  for (const a of outline.anchors) anchorById.set(a.id, a);

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

  const imageUrlFor = (s: ImageGenState | undefined): string | null => {
    if (s?.status === 'done' && s.filename) {
      return `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(s.filename)}`;
    }
    return null;
  };
  const spriteUrlFor = (s: CharacterGenState | undefined): string | null => {
    if (s?.status === 'done' && s.idleFilename) {
      return `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(s.idleFilename)}`;
    }
    return null;
  };

  // Раскладка через dagre — слева направо, без перекрытий.
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: NODESEP, ranksep: RANKSEP });

  for (const anchor of outline.anchors) {
    g.setNode(anchor.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of outline.anchorEdges) {
    if (anchorById.has(e.from) && anchorById.has(e.to)) {
      g.setEdge(e.from, e.to);
    }
  }

  dagre.layout(g);

  const nodes: Node<AnchorNodeData>[] = outline.anchors.map(anchor => {
    const dn = g.node(anchor.id);
    const x = dn.x - dn.width / 2;
    const y = dn.y - dn.height / 2;

    const imageUrl = imageUrlFor(images[anchor.id]);
    const spriteUrl = anchor.characterFocus ? spriteUrlFor(characters[anchor.characterFocus]) : null;

    return {
      id: anchor.id,
      type: 'anchor',
      position: { x, y },
      data: {
        ...anchor,
        routeColor: routeColor(anchor.routeId),
        imageUrl,
        spriteUrl,
      },
      draggable: true,
    };
  });

  const edges: Edge[] = outline.anchorEdges.map((e, i) => {
    const targetAnchor = anchorById.get(e.to);
    const segKey = `${e.from}->${e.to}`;
    const hasSegment = !!segments[segKey];
    const segIssues = validations[segKey] ?? [];
    const hasError = segIssues.some(it => it.severity === 'error');
    const hasWarning = segIssues.some(it => it.severity === 'warning');
    const routeStroke = targetAnchor ? routeColor(targetAnchor.routeId) : '#9ca3af';
    // Цветовая схема:
    //   нет сегмента      → пунктир, цвет маршрута, низкая прозрачность
    //   сегмент валиден   → толстая сплошная, цвет маршрута, ✓
    //   warning           → жёлтый цвет, ⚠
    //   error             → красный цвет, ✗
    const stroke = hasError ? '#dc2626' : hasWarning ? '#d97706' : routeStroke;
    const label = hasError ? '✗' : hasWarning ? '⚠' : hasSegment ? '✓' : undefined;
    const labelTooltip =
      segIssues.length > 0 ? segIssues.map(it => `[${it.severity}] ${it.scope}: ${it.message}`).join('\n') : undefined;
    return {
      id: `e-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: false,
      style: hasSegment
        ? { stroke, strokeWidth: hasError ? 3 : 2.5 }
        : { stroke: routeStroke, strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.6 },
      label,
      labelStyle: label ? { fill: stroke, fontWeight: 700 } : undefined,
      labelBgStyle: label ? { fill: '#fff', fillOpacity: 0.9 } : undefined,
      data: { tooltip: labelTooltip },
    };
  });

  return { nodes, edges };
}
