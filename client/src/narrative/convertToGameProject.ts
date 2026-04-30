import type { Brief, DraftDialogueLine, GeneratedSegment, OutlinePlan } from './types';
import type { ImageGenState } from './narrativeStore';

/**
 * Базовый URL image-сервера, который раздаёт сгенерированные image_gen-ом
 * картинки. Тот же, что использует существующий main canvas.
 */
export const IMAGE_SERVER_BASE = 'http://localhost:3007';

function imageUrlFor(state: ImageGenState | undefined): string {
  if (state?.status === 'done' && state.filename) {
    return `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(state.filename)}`;
  }
  return '';
}

/**
 * Конвертация procedural-narrative-артефактов в формат, который читает
 * существующий game/-движок (см. game/src/types.ts).
 *
 *   - Якоря и сгенерированные сцены становятся узлами SceneGraph.
 *   - Якоря с НЕсгенерированными исходящими сегментами получают
 *     placeholder-выходы напрямую к anchorTo.
 *   - Якоря с сгенерированными сегментами получают выход к entrySceneId,
 *     а сцены сегмента — выходы по choice.id; nextSceneId === null
 *     транслируется в edge на anchorTo.
 *
 * Контракт совместим с runtime-движком (engine.ts читает graph.edges по
 * sourceHandle, ищет start-узел как тот, у которого нет входящих рёбер).
 */

// ── game/-схема, локально воспроизведена ──────────────────────────────────

export type GameSceneOutput = {
  id: string;
  text: string;
};

export type GameSceneNodeData = {
  label: string;
  image: string;
  outputs: GameSceneOutput[];
};

export type GameSceneNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: GameSceneNodeData;
};

export type GameSceneEdge = {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
};

export type GameSceneGraph = {
  nodes: GameSceneNode[];
  edges: GameSceneEdge[];
};

export type GameProjectFile = {
  title: string;
  scenes: string;
  settings: {
    sceneFadeInMs?: number;
    choiceAppearDelayMs?: number;
    endFadeInMs?: number;
  };
};

// ── Conversion ─────────────────────────────────────────────────────────────

export type ConversionStats = {
  anchorScenes: number;
  draftScenes: number;
  generatedSegments: number;
  placeholderEdges: number;
  totalEdges: number;
  imagesEmbedded: number;
};

export type ConversionResult = {
  project: GameProjectFile;
  scenes: GameSceneGraph;
  stats: ConversionStats;
};

const ANCHOR_X_STEP = 320;
const ANCHOR_Y_STEP = 220;
const DRAFT_X_STEP = 220;
const DRAFT_Y_OFFSET = 110;

function escapeNL(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

function renderDialogue(dialogue: DraftDialogueLine[]): string {
  if (!dialogue.length) return '';
  return dialogue.map(d => `${d.speaker}: ${d.line}`).join('\n');
}

function renderDraftSceneText(narration: string, dialogue: DraftDialogueLine[]): string {
  const parts = [escapeNL(narration)];
  const dlg = renderDialogue(dialogue);
  if (dlg) parts.push(dlg);
  return parts.filter(Boolean).join('\n\n');
}

function renderAnchorText(summary: string, anchorId: string): string {
  // Если у якоря пустой summary, оставим хоть какое-то «лицо» для отладки.
  return escapeNL(summary) || `[якорь ${anchorId}]`;
}

export function convertToGameProject(
  brief: Brief,
  outline: OutlinePlan,
  segments: Record<string, GeneratedSegment>,
  images: Record<string, ImageGenState> = {},
): ConversionResult {
  const nodes: GameSceneNode[] = [];
  const edges: GameSceneEdge[] = [];
  const anchorOutputs = new Map<string, GameSceneOutput[]>(); // by anchor id
  let placeholderEdges = 0;
  let generatedSegments = 0;
  let imagesEmbedded = 0;

  // Сортировка маршрутов и порядок появления для y-позиций.
  const routes: string[] = [];
  for (const a of outline.anchors) if (!routes.includes(a.routeId)) routes.push(a.routeId);
  routes.sort((a, b) => (a === 'common' ? -1 : b === 'common' ? 1 : 0));
  const routeIdx = new Map(routes.map((r, i) => [r, i]));

  // ── 1. Якоря ───────────────────────────────────────────────────────────
  for (const anchor of outline.anchors) {
    const image = imageUrlFor(images[anchor.id]);
    if (image) imagesEmbedded++;
    nodes.push({
      id: anchor.id,
      type: 'scene',
      position: {
        x: anchor.act * ANCHOR_X_STEP,
        y: (routeIdx.get(anchor.routeId) ?? 0) * ANCHOR_Y_STEP,
      },
      data: {
        label: renderAnchorText(anchor.summary, anchor.id),
        image,
        outputs: [], // дозаполним из anchorEdges + segments
      },
    });
    anchorOutputs.set(anchor.id, []);
  }

  // ── 2. Сегменты + рёбра между якорями ──────────────────────────────────
  for (const e of outline.anchorEdges) {
    const segKey = `${e.from}->${e.to}`;
    const seg = segments[segKey];
    const targetAnchor = outline.anchors.find(a => a.id === e.to);
    const outputText = targetAnchor
      ? `→ ${targetAnchor.characterFocus ? targetAnchor.characterFocus + ': ' : ''}${
          truncate(targetAnchor.summary, 60) || targetAnchor.id
        }`
      : `→ ${e.to}`;

    if (!seg) {
      // Сегмент не сгенерирован → прямое ребро от anchorFrom к anchorTo.
      const outId = `${e.from}__to__${e.to}`;
      anchorOutputs.get(e.from)!.push({ id: outId, text: outputText });
      edges.push({
        id: `e_${outId}`,
        source: e.from,
        sourceHandle: outId,
        target: e.to,
      });
      placeholderEdges++;
    } else {
      generatedSegments++;
      // Выход якоря-источника → entry-сцена сегмента.
      const entryOutId = `${e.from}__enter__${seg.entrySceneId}`;
      anchorOutputs.get(e.from)!.push({ id: entryOutId, text: outputText });
      edges.push({
        id: `e_${entryOutId}`,
        source: e.from,
        sourceHandle: entryOutId,
        target: seg.entrySceneId,
      });

      // Сцены сегмента наследуют фон от anchorFrom — это типичная VN-логика:
      // фон меняется на якорной сцене, а внутри сегмента остаётся стабильным.
      const segmentImage = imageUrlFor(images[e.from]);
      const baseY = (routeIdx.get(targetAnchor?.routeId ?? 'common') ?? 0) * ANCHOR_Y_STEP + DRAFT_Y_OFFSET;
      seg.scenes.forEach((draft, idx) => {
        if (segmentImage) imagesEmbedded++;
        nodes.push({
          id: draft.id,
          type: 'scene',
          position: {
            x: e.to
              ? Number(outline.anchors.find(a => a.id === e.from)?.act ?? 1) * ANCHOR_X_STEP + (idx + 1) * DRAFT_X_STEP
              : idx * DRAFT_X_STEP,
            y: baseY,
          },
          data: {
            label: renderDraftSceneText(draft.narration, draft.dialogue),
            image: segmentImage,
            outputs: draft.choices.map(c => ({ id: c.id, text: c.text })),
          },
        });

        // Рёбра choice -> next.
        for (const choice of draft.choices) {
          const target = choice.nextSceneId === null ? e.to : choice.nextSceneId;
          edges.push({
            id: `e_${choice.id}`,
            source: draft.id,
            sourceHandle: choice.id,
            target,
          });
        }
      });
    }
  }

  // ── 3. Применяем накопленные outputs к anchor-нодам ────────────────────
  for (const node of nodes) {
    const outs = anchorOutputs.get(node.id);
    if (outs) node.data.outputs = outs;
  }

  // ── 4. Метаданные проекта ──────────────────────────────────────────────
  const title = outline.title?.trim() || `${brief.world.setting.place} — пилот`;
  const project: GameProjectFile = {
    title,
    scenes: './scenes.json',
    settings: {
      sceneFadeInMs: 600,
      choiceAppearDelayMs: 100,
      endFadeInMs: 400,
    },
  };

  const stats: ConversionStats = {
    anchorScenes: outline.anchors.length,
    draftScenes: nodes.length - outline.anchors.length,
    generatedSegments,
    placeholderEdges,
    totalEdges: edges.length,
    imagesEmbedded,
  };

  return { project, scenes: { nodes, edges }, stats };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// ── Browser download helpers ──────────────────────────────────────────────

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '') || 'project'
  );
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
