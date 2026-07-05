import type {
  AnchorBeat,
  AnchorPlan,
  Brief,
  EndingVariant,
  WorldModel,
  DraftDialogueLine,
  GeneratedSegment,
  OutlinePlan,
  StoryOutlinePlan,
  NarrationWeb,
  DialogueVariant,
  DialogueVariantBracket,
} from './types';
import { COMMON_RELATIONSHIP_VARS } from './types';
import type { CharacterGenState, ImageGenState } from './narrativeStore';
import { IMAGE_SERVER_BASE, resolveEmotionToSpriteUrl, pickCharacterEmotion } from './emotionResolver';
import { ARCHETYPES } from './archetypes';

export function imageUrlFor(state: ImageGenState | undefined): string {
  if (state?.status === 'done' && state.filename) {
    return `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(state.filename)}`;
  }
  return '';
}

function pickAnchorSprite(anchor: AnchorPlan, characters: Record<string, CharacterGenState>): string {
  if (!anchor.characterFocus) return '';
  return resolveEmotionToSpriteUrl(characters[anchor.characterFocus], anchor.characterEmotion).url;
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

export type GameSceneType = 'narration' | 'dialogue' | 'branch' | 'router' | 'anchor';

export type GameOutputEffects = {
  stateDeltas?: Record<string, number>;
  flagSet?: string[];
  flagClear?: string[];
};

export type GameSceneOutput = {
  id: string;
  text: string;
  effects?: GameOutputEffects;
};

export type GameSpriteEntry = {
  url: string;
  position: 'left' | 'center' | 'right';
};

/** Локальная реплика game/src/types.ts SceneAudioProfile. */
export type GameSceneAudioProfile = {
  liId: string;
  positiveUrl?: string;
  negativeUrl?: string;
  positiveGte: number;
  negativeLte: number;
};

export type GameSceneNodeData = {
  label: string;
  image: string;
  sprite?: string;
  sprites?: GameSpriteEntry[];
  outputs: GameSceneOutput[];
  sceneType?: GameSceneType;
  audioProfile?: GameSceneAudioProfile;
  sfxUrl?: string;
};

export type GameSceneNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: GameSceneNodeData;
};

export type GameStateCondition = {
  path: string;
  gte?: number;
  lte?: number;
};

export type GameSceneEdge = {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  condition?: GameStateCondition[];
};

export type GameSceneGraph = {
  nodes: GameSceneNode[];
  edges: GameSceneEdge[];
};

export type GameStateVarSchema = {
  range: [number, number];
  default: number;
};

export type GameStateSchema = {
  vars: Record<string, GameStateVarSchema>;
  flags: string[];
};

/** Компактный манифест мира для карты в плеере (game/src/types.ts).
 *  Зеркалит WorldManifest движка. */
export type GameWorldManifest = {
  locations: { id: string; name: string; mood?: string; specialKind?: string }[];
  edges: { from: string; to: string; via?: string }[];
};

export type GameProjectFile = {
  title: string;
  scenes: string;
  settings: {
    sceneFadeInMs?: number;
    sceneFadeOutMs?: number;
    choiceAppearDelayMs?: number;
    endFadeInMs?: number;
    stateSchema?: GameStateSchema;
    world?: GameWorldManifest;
    bgmUrl?: string;
    /** Банк эмбиентов: LocationMood → URL. Рендерер выбирает по mood локации. */
    ambientByMood?: Record<string, string>;
    /** Диегетические беды особых локаций: SpecialAmbientKind → URL. */
    ambientBySpecial?: Record<string, string>;
    crossfadeDurationMs?: number;
    bgmVolume?: number;
    sfxVolume?: number;
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
  spritesEmbedded: number;
  emotionsMapped: number;
  emotionsFallback: number;
  idCollisionsFixed: number;
};

export type ConversionResult = {
  project: GameProjectFile;
  scenes: GameSceneGraph;
  stats: ConversionStats;
};

function buildStateSchema(brief: Brief, outline: OutlinePlan): GameStateSchema {
  const vars: Record<string, GameStateVarSchema> = {};
  for (const li of brief.loveInterests) {
    const arch = ARCHETYPES[li.archetype];
    for (const v of COMMON_RELATIONSHIP_VARS) {
      const key = `relationship[${li.id}].${v}`;
      const initial = arch?.initialState?.[v];
      vars[key] = {
        range: [-1, 1],
        default: initial ? (initial[0] + initial[1]) / 2 : 0,
      };
    }
    if (arch?.additionalStateVars) {
      for (const [k, decl] of Object.entries(arch.additionalStateVars)) {
        vars[k] = { range: decl.range, default: decl.default };
      }
    }
  }
  const flags: string[] = [];
  for (const a of outline.anchors) {
    for (const f of a.establishes) {
      if (!flags.includes(f)) flags.push(f);
    }
  }
  return { vars, flags };
}

export function assignPositions(count: number): Array<'left' | 'center' | 'right'> {
  if (count <= 1) return ['center'];
  if (count === 2) return ['left', 'right'];
  return ['left', 'center', 'right'];
}

const ANCHOR_X_STEP = 320;
const ANCHOR_Y_STEP = 220;
const DRAFT_X_STEP = 220;
const DRAFT_Y_OFFSET = 110;

export function escapeNL(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

function renderDialogue(dialogue: DraftDialogueLine[]): string {
  if (!dialogue.length) return '';
  return dialogue.map(d => `${d.speaker}: ${d.line}`).join('\n');
}

export function renderDraftSceneText(narration: string, dialogue: DraftDialogueLine[]): string {
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
  characters: Record<string, CharacterGenState> = {},
): ConversionResult {
  const nodes: GameSceneNode[] = [];
  const edges: GameSceneEdge[] = [];
  const anchorOutputs = new Map<string, GameSceneOutput[]>(); // by anchor id
  let placeholderEdges = 0;
  let generatedSegments = 0;
  let imagesEmbedded = 0;
  let spritesEmbedded = 0;
  let emotionsMapped = 0;
  let emotionsFallback = 0;
  let idCollisionsFixed = 0;

  // ── 0. Дедупликация scene ID ──────────────────────────────────────────
  //  LLM-генератор может выдать одинаковые scene.id в разных сегментах
  //  или scene.id совпадающий с anchor.id. При конвертации это ломает
  //  граф — рёбра из разных сегментов смешиваются через общий node.id.
  const reservedIds = new Set(outline.anchors.map(a => a.id));
  const segValues = Object.values(segments);
  for (let si = 0; si < segValues.length; si++) {
    const seg = segValues[si];
    if (!seg) continue;
    const renames = new Map<string, string>();
    for (const scene of seg.scenes) {
      if (reservedIds.has(scene.id)) {
        const newId = `${scene.id}__${si}`;
        renames.set(scene.id, newId);
        scene.id = newId;
        idCollisionsFixed++;
      }
      reservedIds.add(scene.id);
    }
    if (renames.size > 0) {
      if (renames.has(seg.entrySceneId)) {
        seg.entrySceneId = renames.get(seg.entrySceneId)!;
      }
      for (const scene of seg.scenes) {
        for (const choice of scene.choices) {
          if (choice.nextSceneId !== null && renames.has(choice.nextSceneId)) {
            choice.nextSceneId = renames.get(choice.nextSceneId)!;
          }
        }
      }
    }
  }

  // Сортировка маршрутов и порядок появления для y-позиций.
  const routes: string[] = [];
  for (const a of outline.anchors) if (!routes.includes(a.routeId)) routes.push(a.routeId);
  routes.sort((a, b) => (a === 'common' ? -1 : b === 'common' ? 1 : 0));
  const routeIdx = new Map(routes.map((r, i) => [r, i]));

  // ── 1. Якоря ───────────────────────────────────────────────────────────
  for (const anchor of outline.anchors) {
    const image = imageUrlFor(images[anchor.id]);
    const sprite = pickAnchorSprite(anchor, characters);
    if (image) imagesEmbedded++;
    if (sprite) spritesEmbedded++;
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
        sprite: sprite || undefined,
        sprites: sprite ? [{ url: sprite, position: 'center' as const }] : undefined,
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

        const positions = assignPositions(draft.charactersPresent.length);
        const sprites: GameSpriteEntry[] = [];
        for (let ci = 0; ci < draft.charactersPresent.length; ci++) {
          const liId = draft.charactersPresent[ci];
          const emotion = pickCharacterEmotion(draft, liId);
          const { url, isFallback } = resolveEmotionToSpriteUrl(characters[liId], emotion);
          if (url) sprites.push({ url, position: positions[ci] ?? 'center' });
          if (isFallback) emotionsFallback++;
          else if (url) emotionsMapped++;
        }
        spritesEmbedded += sprites.length;

        const legacySprite = sprites[0]?.url;
        const isNarration = draft.choices.length === 0;
        const outputs: GameSceneOutput[] = isNarration
          ? []
          : draft.choices.map(c => {
              const out: GameSceneOutput = { id: c.id, text: c.text };
              const hasEffects =
                Object.keys(c.effects.stateDeltas).length > 0 ||
                c.effects.flagSet.length > 0 ||
                c.effects.flagClear.length > 0;
              if (hasEffects) {
                out.effects = {
                  stateDeltas: Object.keys(c.effects.stateDeltas).length > 0 ? c.effects.stateDeltas : undefined,
                  flagSet: c.effects.flagSet.length > 0 ? c.effects.flagSet : undefined,
                  flagClear: c.effects.flagClear.length > 0 ? c.effects.flagClear : undefined,
                };
              }
              return out;
            });

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
            sprite: legacySprite || undefined,
            sprites: sprites.length ? sprites : undefined,
            outputs,
            sceneType: isNarration ? ('narration' as const) : undefined,
          },
        });

        if (isNarration) {
          const nextScene = seg.scenes[idx + 1];
          const target = nextScene ? nextScene.id : e.to;
          const autoOutId = `${draft.id}__auto_continue`;
          outputs.push({ id: autoOutId, text: '' });
          edges.push({
            id: `e_${autoOutId}`,
            source: draft.id,
            sourceHandle: autoOutId,
            target,
          });
        } else {
          for (const choice of draft.choices) {
            const target = choice.nextSceneId === null ? e.to : choice.nextSceneId;
            edges.push({
              id: `e_${choice.id}`,
              source: draft.id,
              sourceHandle: choice.id,
              target,
            });
          }
        }
      });
    }
  }

  // ── 3. Применяем накопленные outputs + sceneType к anchor-нодам ────────
  for (const node of nodes) {
    const outs = anchorOutputs.get(node.id);
    if (outs) {
      node.data.outputs = outs;
      node.data.sceneType = 'router';
    }
  }

  // ── 4. Метаданные проекта ──────────────────────────────────────────────
  const title = outline.title?.trim() || `${brief.world.setting.place} — пилот`;
  const stateSchema = buildStateSchema(brief, outline);
  const project: GameProjectFile = {
    title,
    scenes: './scenes.json',
    settings: {
      sceneFadeInMs: 600,
      choiceAppearDelayMs: 100,
      endFadeInMs: 400,
      stateSchema,
    },
  };

  const stats: ConversionStats = {
    anchorScenes: outline.anchors.length,
    draftScenes: nodes.length - outline.anchors.length,
    generatedSegments,
    placeholderEdges,
    totalEdges: edges.length,
    imagesEmbedded,
    spritesEmbedded,
    emotionsMapped,
    emotionsFallback,
    idCollisionsFixed,
  };

  return { project, scenes: { nodes, edges }, stats };
}

// ── Story-layer conversion (two-layer architecture) ──────────────────────

export function buildStoryStateSchema(brief: Brief, outline: StoryOutlinePlan): GameStateSchema {
  const vars: Record<string, GameStateVarSchema> = {};
  for (const li of brief.loveInterests) {
    const arch = ARCHETYPES[li.archetype];
    for (const v of COMMON_RELATIONSHIP_VARS) {
      const key = `relationship[${li.id}].${v}`;
      const initial = arch?.initialState?.[v];
      vars[key] = {
        range: [-1, 1],
        default: initial ? (initial[0] + initial[1]) / 2 : 0,
      };
    }
    if (arch?.additionalStateVars) {
      for (const [k, decl] of Object.entries(arch.additionalStateVars)) {
        vars[k] = { range: decl.range, default: decl.default };
      }
    }
  }
  const flags: string[] = [];
  for (const a of outline.anchors) {
    for (const f of a.establishes) {
      if (!flags.includes(f)) flags.push(f);
    }
  }
  return { vars, flags };
}

export type StoryConversionStats = {
  anchorScenes: number;
  narrationScenes: number;
  routerNodes: number;
  dialogueScenes: number;
  endingScenes: number;
  totalEdges: number;
  encountersWired: number;
};

export type StoryConversionResult = {
  project: GameProjectFile;
  scenes: GameSceneGraph;
  stats: StoryConversionStats;
};

// АУДИО: сознательно не поддерживается в этом легаси-пути — audioProfile/
// sfxUrl/bgmUrl эмитит только compileWorldGameProject (world-compile-only).
export function convertStoryToGameProject(
  brief: Brief,
  outline: StoryOutlinePlan,
  narrationWebs: Record<string, NarrationWeb>,
  dialogueVariants: Record<string, DialogueVariant[]>,
  anchorBeats: Record<string, AnchorBeat> = {},
  endings: Record<string, EndingVariant> = {},
  images: Record<string, ImageGenState> = {},
  characters: Record<string, CharacterGenState> = {},
  worldModel: WorldModel | null = null,
): StoryConversionResult {
  // Фон: сначала по локации мира (loc:<id>), затем легаси-ключ якоря.
  const bgForAnchor = (anchorId: string): string => {
    const locId = worldModel?.anchorLocations[anchorId];
    const byLoc = locId ? imageUrlFor(images[`loc:${locId}`]) : '';
    return byLoc || imageUrlFor(images[anchorId]);
  };
  const bgForLocation = (locationId: string | undefined, fallback: string): string => {
    if (!locationId) return fallback;
    return imageUrlFor(images[`loc:${locationId}`]) || fallback;
  };
  const transitionLabel = (fromId: string, toId: string): string => {
    const label = anchorBeats[fromId]?.transitions.find(t => t.toAnchorId === toId)?.label?.trim();
    if (label) return label;
    const toAnchor = outline.anchors.find(a => a.id === toId);
    return `→ ${toAnchor?.summary || toId}`;
  };
  const nodes: GameSceneNode[] = [];
  const edges: GameSceneEdge[] = [];
  const allIds = new Set<string>();
  // Псевдо-переменные «встреча состоялась»: met[<liId>].<anchorId>.
  // Выставляются выходами диалога, гейтят повторный вход в encounter.
  const metVars = new Set<string>();
  let routerCount = 0;
  let encountersWired = 0;
  let narrationSceneCount = 0;
  let dialogueSceneCount = 0;

  const uniqueId = (base: string): string => {
    let id = base;
    let i = 0;
    while (allIds.has(id)) {
      id = `${base}__${++i}`;
    }
    allIds.add(id);
    return id;
  };

  // Reserve anchor IDs
  for (const a of outline.anchors) allIds.add(a.id);

  // ── 1. Story anchor nodes ─────────────────────────────────────────────
  const anchorOutputs = new Map<string, GameSceneOutput[]>();
  for (let ai = 0; ai < outline.anchors.length; ai++) {
    const anchor = outline.anchors[ai];
    const image = bgForAnchor(anchor.id);
    nodes.push({
      id: anchor.id,
      type: 'scene',
      position: { x: anchor.act * ANCHOR_X_STEP, y: ai * ANCHOR_Y_STEP },
      data: {
        label: anchorBeats[anchor.id]?.beatText?.trim() || renderAnchorText(anchor.summary, anchor.id),
        image,
        outputs: [],
      },
    });
    anchorOutputs.set(anchor.id, []);
  }

  // ── 2. Narration webs ─────────────────────────────────────────────────
  for (const edge of outline.anchorEdges) {
    const webKey = `${edge.from}->${edge.to}`;
    const web = narrationWebs[webKey];

    if (!web) {
      const outId = uniqueId(`${edge.from}__to__${edge.to}`);
      anchorOutputs.get(edge.from)!.push({ id: outId, text: transitionLabel(edge.from, edge.to) });
      edges.push({ id: `e_${outId}`, source: edge.from, sourceHandle: outId, target: edge.to });
      continue;
    }

    // Pre-pass: уникальные id для сцен паутины (ДО ребра входа, чтобы не
    // «сжечь» id entry-сцены лишним uniqueId и не патчить ребро постфактум).
    const webSceneIdMap = new Map<string, string>();
    for (const scene of web.scenes) {
      const sid = allIds.has(scene.id) ? uniqueId(scene.id) : scene.id;
      allIds.add(sid);
      webSceneIdMap.set(scene.id, sid);
    }

    // Link anchor → web entry
    const entryOutId = uniqueId(`${edge.from}__enter__${web.entrySceneId}`);
    anchorOutputs.get(edge.from)!.push({ id: entryOutId, text: transitionLabel(edge.from, edge.to) });
    edges.push({
      id: `e_${entryOutId}`,
      source: edge.from,
      sourceHandle: entryOutId,
      target: webSceneIdMap.get(web.entrySceneId) ?? web.entrySceneId,
    });

    const segImage = bgForAnchor(edge.from);
    const fromAnchor = outline.anchors.find(a => a.id === edge.from);

    // Есть ли у паутины «обычный» выход к следующему якорю (не через
    // encounter)? Нужен для семантики возврата из диалога: без такого
    // выхода возврат в сцену-источник осиротил бы следующий якорь
    // (легаси-паутины из кэша генерились до этого правила).
    const webHasNonEncounterExit = web.scenes.some(
      sc => sc.choices.length === 0 || sc.choices.some(c => c.nextSceneId === null && !c.encounterTrigger),
    );

    for (const scene of web.scenes) {
      const sceneId = webSceneIdMap.get(scene.id)!;
      const isNarration = scene.choices.length === 0;
      narrationSceneCount++;

      const outputs: GameSceneOutput[] = [];
      if (isNarration) {
        const autoId = uniqueId(`${sceneId}__auto`);
        outputs.push({ id: autoId, text: '' });
        edges.push({ id: `e_${autoId}`, source: sceneId, sourceHandle: autoId, target: edge.to });
      } else {
        for (const choice of scene.choices) {
          const choiceId = uniqueId(choice.id);
          const choiceEffects: GameOutputEffects | undefined = choice.effects?.flagSet?.length
            ? { flagSet: choice.effects.flagSet }
            : undefined;
          outputs.push({ id: choiceId, text: choice.text, effects: choiceEffects });

          if (choice.encounterTrigger) {
            // Wire encounter: choice → router → variants → return
            const liId = choice.encounterTrigger;
            const routerId = uniqueId(`router_${sceneId}_${liId}`);
            const anchorIdForMet = fromAnchor?.id ?? edge.from;
            const metKey = `met[${liId}].${anchorIdForMet}`;
            // У сцены есть обычный (не-encounter) выбор? Если нет, гейтить
            // её encounter-рёбра нельзя: после состоявшихся встреч у сцены
            // не осталось бы активных выходов и движок отрисовал бы ложный
            // «Конец» (актуально для легаси-паутин из кэша).
            const sceneHasNormalChoice = scene.choices.some(c => !c.encounterTrigger);
            const gateRepeat = sceneHasNormalChoice;
            // После диалога возвращаемся в сцену-источник (её оставшиеся
            // выборы) — остаток паутины не теряется. Fallback к следующему
            // якорю: явный nextSceneId отсутствует И паутина не имеет
            // обычного выхода (иначе следующий якорь осиротеет).
            const returnToSource = gateRepeat && webHasNonEncounterExit;
            const returnTarget = choice.nextSceneId
              ? webSceneIdMap.get(choice.nextSceneId) ?? choice.nextSceneId
              : returnToSource
              ? sceneId
              : edge.to;

            // ВАЖНО: met выставляют ВЫХОДЫ диалога, а не сам этот выбор —
            // choose() применяет эффекты до выбора ребра, и выбор с met:1
            // деактивировал бы собственное ребро.
            const encEdge: GameSceneEdge = {
              id: `e_${choiceId}`,
              source: sceneId,
              sourceHandle: choiceId,
              target: routerId,
            };
            if (gateRepeat) encEdge.condition = [{ path: metKey, lte: 0 }];
            edges.push(encEdge);
            metVars.add(metKey);

            // Router node
            const routerNode: GameSceneNode = {
              id: routerId,
              type: 'scene',
              position: { x: 0, y: 0 },
              data: { label: '', image: '', outputs: [], sceneType: 'router' },
            };
            nodes.push(routerNode);
            routerCount++;

            const varKey = `${fromAnchor?.id ?? edge.from}:${liId}`;
            // Роутер берёт первое АКТИВНОЕ ребро, поэтому безусловный neutral
            // обязан идти последним — иначе negative никогда не выиграет.
            const variants = [...(dialogueVariants[varKey] ?? [])].sort(
              (a, b) => BRACKET_WIRE_ORDER[a.bracket] - BRACKET_WIRE_ORDER[b.bracket],
            );

            if (variants.length === 0) {
              // Вариантов нет — роутер проходной. Возврат в сцену-источник
              // дал бы вечную «пустую» кнопку (роутер эффектов не применяет),
              // поэтому уводим к следующему якорю, как раньше.
              const skipId = uniqueId(`${routerId}__skip`);
              routerNode.data.outputs.push({ id: skipId, text: '' });
              edges.push({ id: `e_${skipId}`, source: routerId, sourceHandle: skipId, target: edge.to });
            } else {
              encountersWired++;
              for (const variant of variants) {
                const condition = bracketCondition(liId, variant.bracket);

                const varSceneIdMap = new Map<string, string>();
                for (const vs of variant.scenes) {
                  const vsId = allIds.has(vs.id) ? uniqueId(vs.id) : vs.id;
                  allIds.add(vsId);
                  varSceneIdMap.set(vs.id, vsId);
                }

                const varEntryId = varSceneIdMap.get(variant.entrySceneId) ?? variant.entrySceneId;
                const routerOutId = uniqueId(`${routerId}__${variant.bracket}`);
                routerNode.data.outputs.push({ id: routerOutId, text: '' });

                const condEdge: GameSceneEdge = {
                  id: `e_${routerOutId}`,
                  source: routerId,
                  sourceHandle: routerOutId,
                  target: varEntryId,
                };
                if (condition.length > 0) condEdge.condition = condition;
                edges.push(condEdge);

                for (const vs of variant.scenes) {
                  const vsId = varSceneIdMap.get(vs.id)!;
                  dialogueSceneCount++;

                  const positions = assignPositions(vs.charactersPresent.length);
                  const sprites: GameSpriteEntry[] = [];
                  for (let ci = 0; ci < vs.charactersPresent.length; ci++) {
                    const charId = vs.charactersPresent[ci];
                    const emotion = pickCharacterEmotion(vs, charId);
                    const { url } = resolveEmotionToSpriteUrl(characters[charId], emotion);
                    if (url) sprites.push({ url, position: positions[ci] ?? 'center' });
                  }

                  const vsOutputs: GameSceneOutput[] =
                    vs.choices.length === 0
                      ? []
                      : vs.choices.map(c => {
                          const cId = uniqueId(c.id);
                          const out: GameSceneOutput = { id: cId, text: c.text };
                          // Выход из диалога помечает встречу состоявшейся.
                          const isExit = c.nextSceneId === null;
                          const deltas: Record<string, number> = {
                            ...c.effects.stateDeltas,
                            ...(isExit ? { [metKey]: 1 } : {}),
                          };
                          const hasEff =
                            Object.keys(deltas).length > 0 ||
                            c.effects.flagSet.length > 0 ||
                            c.effects.flagClear.length > 0;
                          if (hasEff) {
                            out.effects = {
                              stateDeltas: Object.keys(deltas).length > 0 ? deltas : undefined,
                              flagSet: c.effects.flagSet.length > 0 ? c.effects.flagSet : undefined,
                              flagClear: c.effects.flagClear.length > 0 ? c.effects.flagClear : undefined,
                            };
                          }
                          return out;
                        });

                  if (vs.choices.length === 0) {
                    const autoId = uniqueId(`${vsId}__auto`);
                    const nextVs = variant.scenes[variant.scenes.indexOf(vs) + 1];
                    const target = nextVs ? varSceneIdMap.get(nextVs.id) ?? nextVs.id : returnTarget;
                    // Терминальная narration-сцена — тоже выход из диалога:
                    // движок применяет эффекты авто-выхода в advance().
                    const isExit = !nextVs;
                    vsOutputs.push(
                      isExit
                        ? { id: autoId, text: '', effects: { stateDeltas: { [metKey]: 1 } } }
                        : { id: autoId, text: '' },
                    );
                    edges.push({ id: `e_${autoId}`, source: vsId, sourceHandle: autoId, target });
                  } else {
                    for (const c of vs.choices) {
                      const cId = vsOutputs.find(o => o.text === c.text)?.id ?? c.id;
                      const target =
                        c.nextSceneId === null ? returnTarget : varSceneIdMap.get(c.nextSceneId) ?? c.nextSceneId;
                      edges.push({ id: `e_${cId}`, source: vsId, sourceHandle: cId, target });
                    }
                  }

                  nodes.push({
                    id: vsId,
                    type: 'scene',
                    position: { x: 0, y: 0 },
                    data: {
                      label: renderDraftSceneText(vs.narration, vs.dialogue),
                      image: segImage,
                      sprite: sprites[0]?.url,
                      sprites: sprites.length ? sprites : undefined,
                      outputs: vsOutputs,
                      sceneType: vs.choices.length === 0 ? 'narration' : 'dialogue',
                    },
                  });
                }
              }

              // Страховка: если neutral-вариант не сгенерился, у роутера нет
              // безусловного ребра и при «среднем» affection он упрётся в
              // ROUTER_DEAD_END. Добавляем безусловный проход последним.
              const hasUnconditional = variants.some(v => bracketCondition(liId, v.bracket).length === 0);
              if (!hasUnconditional) {
                const fallbackId = uniqueId(`${routerId}__fallback`);
                routerNode.data.outputs.push({ id: fallbackId, text: '' });
                edges.push({ id: `e_${fallbackId}`, source: routerId, sourceHandle: fallbackId, target: returnTarget });
              }
            }
          } else {
            // Regular choice — wire to next scene or to anchor
            const target = choice.nextSceneId ? webSceneIdMap.get(choice.nextSceneId) ?? choice.nextSceneId : edge.to;
            edges.push({ id: `e_${choiceId}`, source: sceneId, sourceHandle: choiceId, target });
          }
        }
      }

      nodes.push({
        id: sceneId,
        type: 'scene',
        position: { x: 0, y: 0 },
        data: {
          label: escapeNL(scene.narration),
          image: bgForLocation(scene.locationId, segImage),
          outputs,
          sceneType: isNarration ? 'narration' : 'branch',
        },
      });
    }
  }

  // ── 3. Apply accumulated outputs + sceneType to anchor nodes ──────────
  // Якорь — полноценная сцена-событие (beat), а не немой роутер: игрок
  // читает beatText и сам выбирает переход. Финальный якорь без выходов —
  // narration, движок отрисует его как конец.
  for (const node of nodes) {
    const outs = anchorOutputs.get(node.id);
    if (outs) {
      node.data.outputs = outs;
      node.data.sceneType = outs.length > 0 ? 'anchor' : 'narration';
    }
  }

  // ── 3.5 Endings: resolution → ending_router → эпилоги по state ────────
  // Порядок рёбер: good per-LI (условные), bad (конъюнкция по всем LI),
  // normal — безусловный fallback последним. Пороги относительны стартовому
  // affection архетипа: статичный порог раздавал бы good «бесплатно»
  // архетипам с высоким initialState (mutual_pining стартует с ~0.6).
  let endingSceneCount = 0;
  const resolutionAnchor = outline.anchors.find(a => a.type === 'resolution');
  if (resolutionAnchor && Object.keys(endings).length > 0) {
    const resolutionNode = nodes.find(n => n.id === resolutionAnchor.id);
    if (resolutionNode) {
      const routerId = uniqueId('ending_router');
      const autoId = uniqueId(`${resolutionAnchor.id}__to_endings`);
      resolutionNode.data.outputs = [{ id: autoId, text: '' }];
      resolutionNode.data.sceneType = 'narration';
      edges.push({ id: `e_${autoId}`, source: resolutionAnchor.id, sourceHandle: autoId, target: routerId });

      const endingRouter: GameSceneNode = {
        id: routerId,
        type: 'scene',
        position: { x: 0, y: 0 },
        data: { label: '', image: '', outputs: [], sceneType: 'router' },
      };
      nodes.push(endingRouter);
      routerCount++;

      const affectionMid = (liId: string): number => {
        const li = brief.loveInterests.find(l => l.id === liId);
        const init = li ? ARCHETYPES[li.archetype]?.initialState?.affection : undefined;
        return init ? (init[0] + init[1]) / 2 : 0;
      };
      const clampCond = (v: number) => Math.max(-1, Math.min(1, v));

      // Линейная цепочка narration-сцен эпилога; возвращает id входа.
      const wireEndingChain = (variant: EndingVariant, keySuffix: string): string => {
        const sceneIds = variant.scenes.map((sc, i) => uniqueId(sc.id || `ending_${keySuffix}_${i + 1}`));
        variant.scenes.forEach((sc, i) => {
          const isLast = i === variant.scenes.length - 1;
          const outputs: GameSceneOutput[] = [];
          if (!isLast) {
            const chainAutoId = uniqueId(`${sceneIds[i]}__auto`);
            outputs.push({ id: chainAutoId, text: '' });
            edges.push({
              id: `e_${chainAutoId}`,
              source: sceneIds[i],
              sourceHandle: chainAutoId,
              target: sceneIds[i + 1],
            });
          }
          nodes.push({
            id: sceneIds[i],
            type: 'scene',
            position: { x: 0, y: 0 },
            data: {
              label: escapeNL(sc.narration),
              image: bgForAnchor(resolutionAnchor.id),
              outputs,
              sceneType: 'narration',
            },
          });
          endingSceneCount++;
        });
        return sceneIds[0];
      };

      const wireRouterEdge = (target: string, suffix: string, condition?: GameStateCondition[]) => {
        const outId = uniqueId(`${routerId}__${suffix}`);
        endingRouter.data.outputs.push({ id: outId, text: '' });
        const e: GameSceneEdge = { id: `e_${outId}`, source: routerId, sourceHandle: outId, target };
        if (condition && condition.length > 0) e.condition = condition;
        edges.push(e);
      };

      let hasUnconditionalEnding = false;
      let lastEntry = '';

      // good per-LI — в порядке каста брифа (документированный tie-break:
      // при нескольких «тёплых» LI выигрывает первый в брифе).
      for (const li of brief.loveInterests) {
        const variant = endings[`good:${li.id}`];
        if (!variant) continue;
        const entry = wireEndingChain(variant, `good_${li.id}`);
        lastEntry = entry;
        wireRouterEdge(entry, `good_${li.id}`, [
          { path: `relationship[${li.id}].affection`, gte: clampCond(affectionMid(li.id) + 0.25) },
        ]);
      }

      // bad — конъюнкция «все LI холодны» (массив условий — AND).
      if (endings.bad) {
        const entry = wireEndingChain(endings.bad, 'bad');
        lastEntry = entry;
        wireRouterEdge(
          entry,
          'bad',
          brief.loveInterests.map(li => ({
            path: `relationship[${li.id}].affection`,
            lte: clampCond(affectionMid(li.id) - 0.15),
          })),
        );
      }

      // normal — безусловный fallback последним.
      if (endings.normal) {
        const entry = wireEndingChain(endings.normal, 'normal');
        lastEntry = entry;
        wireRouterEdge(entry, 'normal');
        hasUnconditionalEnding = true;
      }

      // Страховка от ROUTER_DEAD_END, если normal не входит в endingsProfile.
      if (!hasUnconditionalEnding && lastEntry) {
        wireRouterEdge(lastEntry, 'fallback');
      }
    }
  }

  // ── 4. Project metadata ───────────────────────────────────────────────
  const title = outline.title?.trim() || `${brief.world.setting.place} — пилот`;
  const stateSchema = buildStoryStateSchema(brief, outline);
  for (const key of metVars) {
    stateSchema.vars[key] = { range: [0, 1], default: 0 };
  }
  const project: GameProjectFile = {
    title,
    scenes: './scenes.json',
    settings: {
      sceneFadeInMs: 600,
      choiceAppearDelayMs: 100,
      endFadeInMs: 400,
      stateSchema,
    },
  };

  return {
    project,
    scenes: { nodes, edges },
    stats: {
      anchorScenes: outline.anchors.length,
      narrationScenes: narrationSceneCount,
      routerNodes: routerCount,
      dialogueScenes: dialogueSceneCount,
      endingScenes: endingSceneCount,
      totalEdges: edges.length,
      encountersWired,
    },
  };
}

// Порядок проводки bracket-рёбер у encounter-роутера. Движок берёт первое
// активное ребро, поэтому условные (positive/negative) идут раньше
// безусловного neutral-fallback-а.
export const BRACKET_WIRE_ORDER: Record<DialogueVariantBracket, number> = {
  positive: 0,
  negative: 1,
  neutral: 2,
};

// Единственная точка истины порогов тона. Ими же собираются аудио-профили
// сцен (compileWorldGame) — музыкальный bracket совпадает с диалоговым
// по построению, а не по совпадению литералов.
export const BRACKET_POSITIVE_GTE = 0.3;
export const BRACKET_NEGATIVE_LTE = 0;

export function bracketCondition(liId: string, bracket: DialogueVariantBracket): GameStateCondition[] {
  const path = `relationship[${liId}].affection`;
  switch (bracket) {
    case 'positive':
      return [{ path, gte: BRACKET_POSITIVE_GTE }];
    case 'negative':
      return [{ path, lte: BRACKET_NEGATIVE_LTE }];
    case 'neutral':
      return [];
  }
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
