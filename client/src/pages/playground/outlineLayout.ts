import type { Node, Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { type StoryAnchor, type ImageGenState, type StoryOutlinePlan, IMAGE_SERVER_BASE } from '@/narrative';

export type AnchorNodeData = StoryAnchor & {
  actColor: string;
  imageUrl: string | null;
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 280;
const NODESEP = 50;
const RANKSEP = 120;

const ACT_PALETTE = [
  '#fbbf24', // amber  — act 1
  '#0ea5e9', // sky    — act 2
  '#8b5cf6', // violet — act 3
  '#ec4899', // pink   — act 4
  '#22c55e', // green  — act 5
];

export function actColor(act: number): string {
  return ACT_PALETTE[(act - 1) % ACT_PALETTE.length];
}

const imageUrlFor = (s: ImageGenState | undefined): string | null => {
  if (s?.status === 'done' && s.filename) {
    return `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(s.filename)}`;
  }
  return null;
};

export function computeAnchorLayout(
  outline: StoryOutlinePlan,
  images: Record<string, ImageGenState> = {},
): {
  nodes: Node<AnchorNodeData>[];
  edges: Edge[];
} {
  const anchorById = new Map<string, StoryAnchor>();
  for (const a of outline.anchors) anchorById.set(a.id, a);

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

    return {
      id: anchor.id,
      type: 'anchor',
      position: { x, y },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
      data: {
        ...anchor,
        actColor: actColor(anchor.act),
        imageUrl: imageUrlFor(images[anchor.id]),
      },
      draggable: true,
    };
  });

  const edges: Edge[] = outline.anchorEdges.map((e, i) => {
    const targetAnchor = anchorById.get(e.to);
    const color = targetAnchor ? actColor(targetAnchor.act) : '#9ca3af';

    return {
      id: `e-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: false,
      style: { stroke: color, strokeWidth: 2 },
      interactionWidth: 20,
    };
  });

  return { nodes, edges };
}
