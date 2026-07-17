import type { Brief, DraftDialogueLine, StoryOutlinePlan, DialogueVariantBracket } from './types';
import { COMMON_RELATIONSHIP_VARS } from './types';
import type { ImageGenState } from './narrativeStore';
import { IMAGE_SERVER_BASE } from './emotionResolver';
import { ARCHETYPES } from './archetypes';

export function imageUrlFor(state: ImageGenState | undefined): string {
  if (state?.status === 'done' && state.filename) {
    return `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(state.filename)}`;
  }
  return '';
}

/**
 * Утилиты game/-схемы для компиляторов (см. game/src/types.ts): типы
 * SceneGraph/GameProjectFile, bracket-константы, рендер текста сцен,
 * schema стейта. Легаси-конвертеры (outline→graph) снесены фазой 8
 * плана docs/plans/calendar-branching.md — компилятор один, календарный.
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

/** Локальная реплика game/src/types.ts SceneLineEntry. */
export type GameSceneLineEntry = {
  speaker?: string;
  text: string;
  sprites?: GameSpriteEntry[];
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
  lines?: GameSceneLineEntry[];
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
    /** Календарь для HUD рантайма (game/src/calendarState.ts): «День N · часть дня». */
    calendar?: {
      slotCount: number;
      dayparts: string[];
      actBoundaries: number[];
      /** Фаз внутри части дня (малая стрелка) — HUD показывает их словом. */
      phasesPerSlot?: number;
    };
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

export function assignPositions(count: number): Array<'left' | 'center' | 'right'> {
  if (count <= 1) return ['center'];
  if (count === 2) return ['left', 'right'];
  return ['left', 'center', 'right'];
}

export function escapeNL(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

/**
 * Резолвер id говорящего → отображаемое имя. Реплики хранят speaker как id
 * персонажа ('kira'), тогда как проза-нарратив использует имя ('Кира'). Без
 * резолва подпись реплики рассинхронизирована с текстом сцены.
 */
export type SpeakerNameResolver = (speakerId: string) => string;

export function speakerNameResolver(brief: Brief): SpeakerNameResolver {
  const byId = new Map(brief.loveInterests.map(li => [li.id, li.name]));
  return id => byId.get(id) ?? id;
}

function renderDialogue(dialogue: DraftDialogueLine[], resolveName?: SpeakerNameResolver): string {
  if (!dialogue.length) return '';
  return dialogue.map(d => `${resolveName?.(d.speaker) ?? d.speaker}: ${d.line}`).join('\n');
}

export function renderDraftSceneText(
  narration: string,
  dialogue: DraftDialogueLine[],
  resolveName?: SpeakerNameResolver,
): string {
  const parts = [escapeNL(narration)];
  const dlg = renderDialogue(dialogue, resolveName);
  if (dlg) parts.push(dlg);
  return parts.filter(Boolean).join('\n\n');
}

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

/** Пороги тона: абсолютные (легаси) либо относительные старту архетипа. */
export type BracketThresholds = { positiveGte: number; negativeLte: number };

export const LEGACY_BRACKET_THRESHOLDS: BracketThresholds = {
  positiveGte: BRACKET_POSITIVE_GTE,
  negativeLte: BRACKET_NEGATIVE_LTE,
};

/** Отступ тона от старта архетипа: ровно легаси-случай при A0 = 0.15. */
export const BRACKET_OFFSET = 0.15;

/**
 * Пороги тона ОТНОСИТЕЛЬНО старта архетипа (A0 = середина initialState.affection,
 * она же дефолт stateSchema).
 *
 * Зачем: пороги были абсолютными (warm ≥ 0.3), а старт — архетипным. У
 * forbidden (A0=0.5) и mutual_pining (A0=0.6) игра открывалась УЖЕ за тёплым
 * порогом: персонаж читался влюблённым в слот 0, до единого выбора игрока.
 * Условия концовок при этом всегда были относительными (mid±offset) — тон и
 * прогресс жили в разных шкалах. Относительный порог их мирит: на старте любой
 * архетип нейтрален, а «теплее/холоднее» означает «сдвинулся от своей точки».
 */
export function bracketThresholdsFor(a0: number): BracketThresholds {
  return { positiveGte: a0 + BRACKET_OFFSET, negativeLte: a0 - BRACKET_OFFSET };
}

export function bracketCondition(
  liId: string,
  bracket: DialogueVariantBracket,
  thresholds: BracketThresholds = LEGACY_BRACKET_THRESHOLDS,
): GameStateCondition[] {
  const path = `relationship[${liId}].affection`;
  switch (bracket) {
    case 'positive':
      return [{ path, gte: thresholds.positiveGte }];
    case 'negative':
      return [{ path, lte: thresholds.negativeLte }];
    case 'neutral':
      return [];
  }
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
