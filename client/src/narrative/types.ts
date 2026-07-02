/**
 * Procedural narrative pilot — shared types.
 *
 * Контракт data-моделей для пайплайна brief -> outline -> anchors -> branches.
 * Документировано подробно, чтобы каждое поле имело конкретного потребителя
 * (LLM-генератор, валидатор, runtime-движок, image_gen).
 */

// ============================================================================
// STATE MODEL
// ============================================================================

/** Имя относительной переменной, например "relationship[kira].affection". */
export type StateVarPath = string;

/** Диапазон [min, max] для градиентных переменных state. */
export type Range = [number, number];

/** Базовые relationship-переменные, общие для всех romance_vn архетипов. */
export const COMMON_RELATIONSHIP_VARS = ['affection', 'trust', 'tension'] as const;
export type CommonRelationshipVar = typeof COMMON_RELATIONSHIP_VARS[number];

/** Объявление дополнительной state-переменной (вводится архетипом). */
export type StateVarDeclaration = {
  /** [min, max] возможных значений. */
  range: Range;
  /** Стартовое значение, если архетип не задаст диапазон явно. */
  default: number;
  /** Свободное описание для LLM-генератора и отладки. */
  description: string;
};

// ============================================================================
// ARCHETYPE LIBRARY
// ============================================================================

/** Идентификатор архетипа маршрута LI. */
export type ArchetypeId = 'slow_burn' | 'enemies_to_lovers' | 'forbidden' | 'mutual_pining';

/**
 * Высокоуровневый тэг формы trajectory. Каждое значение разворачивается в
 * формальный валидатор (см. validateTrajectory в narrative/validation.ts позже).
 */
export type TrajectoryShape =
  | 'monotone_gradual'
  | 'tension_to_affection_pivot'
  | 'growth_against_constraint'
  | 'delayed_mutual_acknowledgment';

/** Профиль движения одной state-переменной по маршруту. */
export type VarTrajectory =
  | 'monotone_increase'
  | 'monotone_increase_after_pivot'
  | 'stable_low'
  | 'stable_high'
  | 'stagnant_then_jump'
  | 'stagnant_then_late_jump'
  | 'high_then_drop_after_pivot'
  | 'stable_or_increase'
  | 'increase_then_resolve_at_crisis'
  | 'slow_increase_until_crisis';

/** Описание trajectory на маршруте архетипа. */
export type ArchetypeTrajectory = {
  shape: TrajectoryShape;
  /** Профиль для каждой переменной (включая additional vars). */
  vars: Record<string, VarTrajectory>;
  /** Ограничение на максимальный шаг переменной за одну сцену (если применимо). */
  maxPerSceneDelta?: number;
  /** Beat, в котором происходит инверсия / поворот (для pivot-shape архетипов). */
  pivotBeat?: BeatType;
};

/** Тип обязательного beat-а на маршруте архетипа. */
export type BeatType =
  | 'accumulation_moment'
  | 'subtle_realization'
  | 'tension_flip'
  | 'honest_confrontation'
  | 'constraint_revealed'
  | 'constraint_test'
  | 'missed_signal'
  | 'almost_confession';

/** Позиция beat-а относительно стандартных якорей маршрута. */
export type BeatPosition =
  | 'before_obstacle_reveal'
  | 'obstacle_reveal'
  | 'after_obstacle_reveal'
  | 'before_crisis'
  | 'crisis'
  | 'after_crisis';

export type RequiredBeat = {
  type: BeatType;
  position: BeatPosition;
  /** Свободный текст: для чего этот beat в нарративе. Идёт в промпт LLM. */
  purpose: string;
};

export type ObstacleType = 'internal' | 'interpersonal' | 'external';

export type EndingKind = 'good' | 'normal' | 'bad';

export type EndingProfile = {
  /** Вес выбора ending-а при пограничном state. Сумма по good/normal/bad ≈ 1. */
  weight: number;
  /** Нарративный тон концовки, для промпта LLM. */
  tone: string;
};

/** Схема обязательных archetype_specifics, которые должна содержать карточка LI. */
export type ArchetypeSpecificsSchema = Record<
  string,
  {
    required: boolean;
    /** Примеры значений для подсказки автору карточки и для LLM-промпта. */
    examples: string[];
  }
>;

/** Полное определение архетипа в библиотеке. */
export type ArchetypeProfile = {
  id: ArchetypeId;
  /** Человекочитаемое описание (для UI и для LLM). */
  description: string;
  /** Стартовый state в начале маршрута. Диапазоны — для случайной инициализации. */
  initialState: Partial<Record<CommonRelationshipVar | string, Range>>;
  /** Дополнительные state-переменные, которые архетип вводит. null = нет. */
  additionalStateVars: Record<string, StateVarDeclaration> | null;
  trajectory: ArchetypeTrajectory;
  /** Beats, обязательные на маршруте поверх стандартных якорей. */
  requiredBeats: RequiredBeat[];
  obstacleType: ObstacleType;
  /** Темы препятствий — попадают в промпт branch-генератора. */
  obstacleThemes: string[];
  endingProfile: Record<EndingKind, EndingProfile>;
  /** Что должно быть в карточке LI как archetype_specifics. null = ничего. */
  archetypeSpecificsSchema: ArchetypeSpecificsSchema | null;
};

// ============================================================================
// BRIEF SCHEMA
// ============================================================================

export type Genre = 'romance_vn'; // пилот, но поле параметризуемо
export type Format = 'single_arc' | 'episodic' | 'vignette';

export type BranchingDensity = 'low' | 'medium' | 'high';

export type BriefScale = {
  acts: number;
  targetDurationMinutes: number;
  branchingDensity: BranchingDensity;
  /** Доля игры на common route, в [0, 1]. */
  commonRouteShare: number;
};

export type WorldSetting = {
  era: string;
  place: string;
  /** Свободный текст с конкретикой. */
  specifics: string;
};

export type WorldTone = {
  mood: string;
  themes: string[];
  /** sweet/cozy ←→ heavy/melodramatic, в [0, 1]. */
  intensity: number;
};

export type ArtStyle = {
  referenceDescriptor: string;
  colorPalette: string[];
  /** Шаблон для image_gen, может содержать плейсхолдеры. */
  modelPromptTemplate: string;
};

export type Protagonist = {
  gender: 'female' | 'male' | 'nonbinary' | 'player_choice';
  /** Плейсхолдер для имени игрока, обычно "{player_name}". */
  namePlaceholder: string;
  /** Стиль внутренних монологов: blank slate => 'neutral_minimal'. */
  voiceStyle: 'neutral_minimal' | 'defined';
};

export type Personality = {
  traits: string[];
  values: string[];
  fears: string[];
  desires: string[];
};

export type Appearance = {
  hair?: string;
  build?: string;
  signatureItem?: string;
  /** Свободный текст для image_gen. */
  freeform?: string;
};

export type LoveInterestCard = {
  id: string;
  name: string;
  age: number;
  roleInWorld: string;
  appearance: Appearance;
  speechPattern: string;
  personality: Personality;
  /** Структурный архетип маршрута. Required. Источник: библиотека архетипов. */
  archetype: ArchetypeId;
  /**
   * Флэйвор архетипа. Должен соответствовать archetypeSpecificsSchema выбранного
   * архетипа. Например для forbidden -> { constraintType: 'social_status' }.
   */
  archetypeSpecifics: Record<string, string> | null;
  preExistingRelationship: string | null;
};

export type EndingsProfile = EndingKind[];

export type Brief = {
  version: '0.1';
  /** null = случайный seed на каждой генерации. */
  seed: number | null;
  genre: Genre;
  format: Format;
  scale: BriefScale;
  endingsProfile: EndingsProfile;
  world: {
    setting: WorldSetting;
    tone: WorldTone;
  };
  artStyle: ArtStyle;
  protagonist: Protagonist;
  loveInterests: LoveInterestCard[];
};

// ============================================================================
// SCENE CONTRACT (downstream artifact, generated from brief)
// ============================================================================

export type AnchorType =
  | 'setup'
  | 'li_introduction'
  | 'common_climax'
  | 'route_opening'
  | 'obstacle_reveal'
  | 'crisis'
  | 'ending';

/**
 * Простое булево выражение по state и flags.
 * JSON-структура (не строковый DSL) ради LLM-friendliness и валидатора.
 */
export type StateExpression =
  | { allOf: StateExpression[] }
  | { anyOf: StateExpression[] }
  | { not: StateExpression }
  | { path: StateVarPath; gte: number }
  | { path: StateVarPath; lte: number }
  | { path: StateVarPath; eq: number }
  | { hasFlag: string }
  | { lacksFlag: string };

export type StateRanges = Record<StateVarPath, Range>;

export type AnchorMeta = {
  type: AnchorType;
  routeId: string;
  act: number;
  entryStateRequired: {
    ranges: StateRanges;
    flagsRequired: string[];
  };
};

export type DialogueLine = {
  speaker: string; // id персонажа или 'narrator'
  emotion?: string;
  line: string;
};

export type ConditionalNarrationNode =
  | { text: string }
  | { if: StateExpression; then: NarrationNode[] }
  | { if: StateExpression; then: NarrationNode[]; else: NarrationNode[] };

export type NarrationNode = ConditionalNarrationNode;

export type ChoiceEffects = {
  stateDeltas: Record<StateVarPath, number>;
  flagSet: string[];
  flagClear: string[];
};

export type Choice = {
  id: string;
  text: string;
  /** Условие отображения выбора. null = всегда виден. */
  visibility: StateExpression | null;
  effects: ChoiceEffects;
  /** null = ветка обрывается, runtime попадёт в следующий якорь по другому пути. */
  nextSceneId: string | null;
};

export type SceneBackground = {
  assetId: string | null;
  generationPrompt: string;
};

export type SceneGenerationMeta = {
  generatedBy: string;
  sourceSegment: string;
  seed: number;
  traceId: string;
};

/**
 * Единица контента. Якорь = сцена с is_anchor=true и заполненным anchor.
 * Граф плоский: движок читает Scene[] и идёт по nextSceneId выбора.
 */
export type Scene = {
  id: string;
  isAnchor: boolean;
  anchor: AnchorMeta | null;
  segmentId: string | null;
  routeId: string;
  act: number;
  entryCondition: StateExpression | null;
  locationId: string;
  timeMarker: string;
  charactersPresent: string[];
  narration: NarrationNode[];
  dialogue: DialogueLine[];
  background: SceneBackground;
  sprites: Record<string, string>;
  choices: Choice[];
  generationMeta: SceneGenerationMeta;
};

// ============================================================================
// PROJECT (top-level artifact, what game engine eventually reads)
// ============================================================================

export type StateSchemaDeclaration = {
  /** common + additional vars из всех использованных архетипов в брифе. */
  variables: Record<StateVarPath, StateVarDeclaration>;
  /** Все известные флаги, что может выставить хотя бы одна сцена. */
  flags: string[];
};

export type GeneratedProject = {
  version: '0.1';
  brief: Brief;
  stateSchema: StateSchemaDeclaration;
  startingSceneId: string;
  scenes: Record<string, Scene>;
};

// ============================================================================
// OUTLINE PLAN (intermediate artifact between brief and full scene graph)
// ============================================================================

/**
 * Outline-планировщик возвращает якорный скелет: набор якорей и DAG-рёбра
 * между ними. Сцены в этот момент ещё не сгенерированы — это первый слой
 * пайплайна, на котором фиксируется структура истории.
 */

export type OutlineAct = {
  act: number;
  purpose: string;
  tone: string;
};

export type AnchorPlan = {
  id: string;
  type: AnchorType;
  routeId: string;
  act: number;
  /** id LI, на котором сфокусирован якорь (для li_introduction / route_*). null = общая сцена. */
  characterFocus: string | null;
  /** Каноническая эмоция персонажа characterFocus в этом якоре. */
  characterEmotion?: string;
  /** 1-2 предложения, что происходит в этом якоре. Авторский контекст для branch-генератора. */
  summary: string;
  /** Факты, которые становятся истинными после прохождения якоря. */
  establishes: string[];
  /** Требование на state при входе. null = нет ограничений (для якорей в начале route). */
  entryStateRequired: {
    ranges: StateRanges;
    flagsRequired: string[];
  } | null;
};

export type AnchorEdge = {
  from: string;
  to: string;
};

export type OutlinePlan = {
  title: string;
  logline: string;
  centralConflict: string;
  acts: OutlineAct[];
  anchors: AnchorPlan[];
  anchorEdges: AnchorEdge[];
};

/**
 * Распарсить и валидировать строковый JSON-ответ от outline-генератора.
 * Бросает Error с диагностикой, если структура не совпадает.
 */
export function parseOutlinePlan(raw: string): OutlinePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`outline JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('outline must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.anchors) || !Array.isArray(obj.anchorEdges) || !Array.isArray(obj.acts)) {
    throw new Error('outline missing required arrays: acts/anchors/anchorEdges');
  }

  const anchors: AnchorPlan[] = obj.anchors.map((a, i) => {
    const anchor = a as Record<string, unknown>;
    if (!anchor.id || !anchor.type || !anchor.routeId) {
      throw new Error(`anchors[${i}] missing required fields (id/type/routeId)`);
    }
    return {
      id: String(anchor.id),
      type: anchor.type as AnchorType,
      routeId: String(anchor.routeId),
      act: typeof anchor.act === 'number' ? anchor.act : 1,
      characterFocus: anchor.characterFocus ? String(anchor.characterFocus) : null,
      characterEmotion: anchor.characterEmotion ? String(anchor.characterEmotion) : undefined,
      summary: String(anchor.summary ?? ''),
      establishes: Array.isArray(anchor.establishes) ? (anchor.establishes as string[]) : [],
      entryStateRequired:
        anchor.entryStateRequired && typeof anchor.entryStateRequired === 'object'
          ? (anchor.entryStateRequired as AnchorPlan['entryStateRequired'])
          : null,
    };
  });

  return {
    title: String(obj.title ?? ''),
    logline: String(obj.logline ?? ''),
    centralConflict: String(obj.centralConflict ?? ''),
    acts: obj.acts as OutlineAct[],
    anchors,
    anchorEdges: obj.anchorEdges as AnchorEdge[],
  };
}

// ============================================================================
// SEGMENT GENERATION (draft-уровень: что LLM возвращает на стадии branch-gen)
// ============================================================================

/**
 * Сцена в "черновой" форме, какой её рождает branch-генератор.
 *
 * Это упрощённая версия Scene:
 *   - narration — простая строка (без условных вставок; уйдёт во второй проход)
 *   - charactersPresent / location / dialogue / choices — как ожидается
 *   - nextSceneId === null означает «ветка ведёт в anchorTo»
 *     (runtime-движок при null будет идти к target-якорю сегмента)
 *
 * Полная Scene-структура с conditional narration и asset-меткой собирается
 * валидатором/конвертером на следующем витке пайплайна.
 */
export type DraftDialogueLine = {
  speaker: string;
  emotion?: string;
  line: string;
};

export type DraftChoice = {
  id: string;
  text: string;
  effects: {
    stateDeltas: Record<StateVarPath, number>;
    flagSet: string[];
    flagClear: string[];
  };
  /** null = ветка ведёт в anchorTo сегмента. */
  nextSceneId: string | null;
};

export type DraftScene = {
  id: string;
  location: string;
  timeMarker: string;
  charactersPresent: string[];
  /** Доминантная эмоция каждого персонажа в сцене (charId → каноническая эмоция). */
  characterEmotions?: Record<string, string>;
  narration: string;
  dialogue: DraftDialogueLine[];
  choices: DraftChoice[];
};

export type GeneratedSegment = {
  fromAnchorId: string;
  toAnchorId: string;
  /** id первой сцены сегмента (куда runtime попадает из anchorFrom). */
  entrySceneId: string;
  scenes: DraftScene[];
};

export function parseGeneratedSegment(raw: string): GeneratedSegment {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`segment JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('segment must be an object');
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.scenes)) {
    throw new Error('segment missing required array: scenes');
  }
  if (!obj.entrySceneId || typeof obj.entrySceneId !== 'string') {
    throw new Error('segment missing required string: entrySceneId');
  }

  const scenes: DraftScene[] = obj.scenes.map((s, i) => {
    const scene = s as Record<string, unknown>;
    if (!scene.id) throw new Error(`scenes[${i}] missing id`);
    return {
      id: String(scene.id),
      location: String(scene.location ?? ''),
      timeMarker: String(scene.timeMarker ?? ''),
      charactersPresent: Array.isArray(scene.charactersPresent) ? (scene.charactersPresent as string[]) : [],
      characterEmotions:
        scene.characterEmotions && typeof scene.characterEmotions === 'object'
          ? (scene.characterEmotions as Record<string, string>)
          : undefined,
      narration: String(scene.narration ?? ''),
      dialogue: Array.isArray(scene.dialogue) ? (scene.dialogue as DraftDialogueLine[]) : [],
      choices: Array.isArray(scene.choices)
        ? (scene.choices as unknown[]).map((c, j): DraftChoice => {
            const choice = c as Record<string, unknown>;
            const effects = (choice.effects ?? {}) as Record<string, unknown>;
            return {
              id: String(choice.id ?? `${scene.id}_c${j}`),
              text: String(choice.text ?? ''),
              effects: {
                stateDeltas: (effects.stateDeltas ?? {}) as Record<StateVarPath, number>,
                flagSet: Array.isArray(effects.flagSet) ? (effects.flagSet as string[]) : [],
                flagClear: Array.isArray(effects.flagClear) ? (effects.flagClear as string[]) : [],
              },
              nextSceneId: choice.nextSceneId ? String(choice.nextSceneId) : null,
            };
          })
        : [],
    };
  });

  return {
    fromAnchorId: String(obj.fromAnchorId ?? ''),
    toAnchorId: String(obj.toAnchorId ?? ''),
    entrySceneId: String(obj.entrySceneId),
    scenes,
  };
}

// ============================================================================
// SEGMENT VALIDATION (basic reachability check)
// ============================================================================

export type SegmentIssue = {
  severity: 'error' | 'warning';
  scope: string;
  message: string;
};

/**
 * Базовая проверка корректности сгенерированного сегмента:
 *   - все nextSceneId ссылаются на существующую сцену в сегменте, либо null (anchor)
 *   - entrySceneId присутствует в scenes
 *   - есть хотя бы одна ветка, ведущая к anchorTo (nextSceneId == null)
 *
 * State-инвариант anchorTo пока не проверяется (это next iteration).
 */
export function validateGeneratedSegment(seg: GeneratedSegment): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const sceneIds = new Set(seg.scenes.map(s => s.id));

  if (!sceneIds.has(seg.entrySceneId)) {
    issues.push({
      severity: 'error',
      scope: 'entry',
      message: `entrySceneId "${seg.entrySceneId}" не найден среди сцен сегмента`,
    });
  }

  let exitCount = 0;
  for (const scene of seg.scenes) {
    if (scene.choices.length === 0) {
      exitCount++;
      continue;
    }
    for (const choice of scene.choices) {
      if (choice.nextSceneId === null) {
        exitCount++;
      } else if (!sceneIds.has(choice.nextSceneId)) {
        issues.push({
          severity: 'error',
          scope: `${scene.id}/choice/${choice.id}`,
          message: `nextSceneId "${choice.nextSceneId}" не найден среди сцен сегмента`,
        });
      }
    }
  }

  if (exitCount === 0) {
    issues.push({
      severity: 'error',
      scope: 'exit',
      message: 'нет ни одной ветки, ведущей в anchorTo (хотя бы один choice.nextSceneId должен быть null)',
    });
  }

  return issues;
}

// ============================================================================
// STORY OUTLINE (story-layer only, replaces per-LI route outline)
// ============================================================================

export type StoryAnchorType = 'setup' | 'location_enter' | 'story_beat' | 'climax' | 'resolution';

export type StoryAnchor = {
  id: string;
  type: StoryAnchorType;
  act: number;
  location: string;
  timeMarker: string;
  summary: string;
  establishes: string[];
  availableLIs: string[];
};

export type StoryOutlinePlan = {
  title: string;
  logline: string;
  acts: OutlineAct[];
  anchors: StoryAnchor[];
  anchorEdges: AnchorEdge[];
};

export function parseStoryOutline(raw: string): StoryOutlinePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`story outline JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('story outline must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.anchors) || !Array.isArray(obj.anchorEdges) || !Array.isArray(obj.acts)) {
    throw new Error('story outline missing required arrays: acts/anchors/anchorEdges');
  }

  const validTypes: StoryAnchorType[] = ['setup', 'location_enter', 'story_beat', 'climax', 'resolution'];

  const anchors: StoryAnchor[] = obj.anchors.map((a, i) => {
    const anchor = a as Record<string, unknown>;
    if (!anchor.id || !anchor.type) {
      throw new Error(`anchors[${i}] missing required fields (id/type)`);
    }
    const anchorType = String(anchor.type) as StoryAnchorType;
    if (!validTypes.includes(anchorType)) {
      throw new Error(`anchors[${i}] invalid type "${anchor.type}", expected one of: ${validTypes.join(', ')}`);
    }
    if (!anchor.location || typeof anchor.location !== 'string') {
      throw new Error(`anchors[${i}] missing required field: location`);
    }
    return {
      id: String(anchor.id),
      type: anchorType,
      act: typeof anchor.act === 'number' ? anchor.act : 1,
      location: String(anchor.location),
      timeMarker: String(anchor.timeMarker ?? ''),
      summary: String(anchor.summary ?? ''),
      establishes: Array.isArray(anchor.establishes) ? (anchor.establishes as string[]) : [],
      availableLIs: Array.isArray(anchor.availableLIs) ? (anchor.availableLIs as string[]) : [],
    };
  });

  return {
    title: String(obj.title ?? ''),
    logline: String(obj.logline ?? ''),
    acts: obj.acts as OutlineAct[],
    anchors,
    anchorEdges: obj.anchorEdges as AnchorEdge[],
  };
}

// ============================================================================
// NARRATION WEB (exploration DAG between story anchors)
// ============================================================================

export type NarrationWebChoice = {
  id: string;
  text: string;
  nextSceneId: string | null;
  encounterTrigger?: string;
  effects?: { flagSet?: string[] };
};

export type NarrationWebScene = {
  id: string;
  location: string;
  narration: string;
  choices: NarrationWebChoice[];
};

export type NarrationWeb = {
  fromAnchorId: string;
  toAnchorId: string;
  entrySceneId: string;
  scenes: NarrationWebScene[];
};

export function parseNarrationWeb(raw: string): NarrationWeb {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`narration web JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('narration web must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.scenes) || !obj.entrySceneId) {
    throw new Error('narration web missing scenes or entrySceneId');
  }

  const scenes: NarrationWebScene[] = (obj.scenes as unknown[]).map((s, i) => {
    const scene = s as Record<string, unknown>;
    if (!scene.id) throw new Error(`scenes[${i}] missing id`);

    const choices: NarrationWebChoice[] = Array.isArray(scene.choices)
      ? (scene.choices as unknown[]).map((c, j) => {
          const ch = c as Record<string, unknown>;
          return {
            id: String(ch.id ?? `${scene.id}_c${j}`),
            text: String(ch.text ?? ''),
            nextSceneId: ch.nextSceneId ? String(ch.nextSceneId) : null,
            encounterTrigger: ch.encounterTrigger ? String(ch.encounterTrigger) : undefined,
            effects: ch.effects
              ? {
                  flagSet: Array.isArray((ch.effects as Record<string, unknown>).flagSet)
                    ? ((ch.effects as Record<string, unknown>).flagSet as string[])
                    : undefined,
                }
              : undefined,
          };
        })
      : [];

    return {
      id: String(scene.id),
      location: String(scene.location ?? ''),
      narration: String(scene.narration ?? ''),
      choices,
    };
  });

  return {
    fromAnchorId: String(obj.fromAnchorId ?? ''),
    toAnchorId: String(obj.toAnchorId ?? ''),
    entrySceneId: String(obj.entrySceneId),
    scenes,
  };
}

export function validateNarrationWeb(web: NarrationWeb, availableLIIds: string[]): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const sceneById = new Map(web.scenes.map(s => [s.id, s]));

  if (!sceneById.has(web.entrySceneId)) {
    issues.push({
      severity: 'error',
      scope: 'entry',
      message: `entrySceneId "${web.entrySceneId}" не найден среди сцен`,
    });
  }

  let hasExitPath = false;
  let hasNonEncounterExit = false;

  // Сцена «умеет выходить» сама: choices=[] (авто-выход) или choice с
  // nextSceneId=null. Encounter-выход тоже выход (диалог вернёт к якорю).
  const canExitDirectly = (scene: NarrationWebScene): boolean =>
    scene.choices.length === 0 || scene.choices.some(c => c.nextSceneId === null);

  for (const scene of web.scenes) {
    if (scene.choices.length === 0) {
      hasExitPath = true;
      hasNonEncounterExit = true;
      continue;
    }

    for (const choice of scene.choices) {
      if (choice.nextSceneId === null && !choice.encounterTrigger) {
        hasExitPath = true;
        hasNonEncounterExit = true;
      } else if (choice.nextSceneId === null && choice.encounterTrigger) {
        hasExitPath = true;
      } else if (choice.nextSceneId !== null && !sceneById.has(choice.nextSceneId)) {
        issues.push({
          severity: 'error',
          scope: `${scene.id}/choice/${choice.id}`,
          message: `nextSceneId "${choice.nextSceneId}" не найден среди сцен`,
        });
      }

      if (choice.encounterTrigger && !availableLIIds.includes(choice.encounterTrigger)) {
        issues.push({
          severity: 'error',
          scope: `${scene.id}/choice/${choice.id}`,
          message: `encounterTrigger "${choice.encounterTrigger}" не найден в availableLIs`,
        });
      }
    }

    // Сцена, где ВСЕ выборы — encounter-триггеры: после гейтинга повторных
    // встреч у неё не останется активных выходов и движок отрисует «Конец».
    if (scene.choices.every(c => Boolean(c.encounterTrigger))) {
      issues.push({
        severity: 'warning',
        scope: `${scene.id}/choices`,
        message: 'все выборы сцены — encounter-триггеры; нужен хотя бы один обычный выход',
      });
    }
  }

  if (!hasExitPath) {
    issues.push({
      severity: 'error',
      scope: 'exit',
      message: 'нет пути к выходу (ни один choice не ведёт к anchorTo)',
    });
  }

  if (!hasNonEncounterExit) {
    issues.push({
      severity: 'warning',
      scope: 'exit',
      message: 'нет пути к выходу без encounter-а (игрок не может пройти мимо)',
    });
  }

  // ── Графовые проверки ────────────────────────────────────────────────
  const forward = (id: string): string[] =>
    (sceneById.get(id)?.choices ?? [])
      .map(c => c.nextSceneId)
      .filter((n): n is string => n !== null && sceneById.has(n));

  // Достижимость от entry.
  const reachable = new Set<string>();
  if (sceneById.has(web.entrySceneId)) {
    const stack = [web.entrySceneId];
    while (stack.length) {
      const cur = stack.pop()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      stack.push(...forward(cur));
    }
    for (const scene of web.scenes) {
      if (!reachable.has(scene.id)) {
        issues.push({
          severity: 'error',
          scope: `reachability/${scene.id}`,
          message: 'сцена недостижима от entrySceneId',
        });
      }
    }
  }

  // Выходимость: из каждой достижимой сцены должен достигаться выход,
  // иначе игрок запирается в подграфе без конца (softlock).
  for (const startId of reachable) {
    const seen = new Set<string>();
    const stack = [startId];
    let exitFound = false;
    while (stack.length && !exitFound) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const scene = sceneById.get(cur)!;
      if (canExitDirectly(scene)) {
        exitFound = true;
        break;
      }
      stack.push(...forward(cur));
    }
    if (!exitFound) {
      issues.push({
        severity: 'error',
        scope: `exit/${startId}`,
        message: 'из этой сцены недостижим ни один выход из паутины (softlock)',
      });
    }
  }

  // Циклы: допустимы («вернуться назад»), но помечаем предупреждением.
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const cycleEdges: string[] = [];
  const dfs = (id: string): void => {
    color.set(id, GRAY);
    for (const next of forward(id)) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        cycleEdges.push(`${id} -> ${next}`);
      } else if (c === WHITE) {
        dfs(next);
      }
    }
    color.set(id, BLACK);
  };
  for (const scene of web.scenes) {
    if ((color.get(scene.id) ?? WHITE) === WHITE) dfs(scene.id);
  }
  if (cycleEdges.length > 0) {
    issues.push({
      severity: 'warning',
      scope: 'cycle',
      message: `в паутине есть циклы: ${cycleEdges.slice(0, 3).join('; ')}${
        cycleEdges.length > 3 ? ` (+${cycleEdges.length - 3})` : ''
      }`,
    });
  }

  return issues;
}

// ============================================================================
// DIALOGUE VARIANT (encounter dialogue per relationship bracket)
// ============================================================================

export type DialogueVariantBracket = 'positive' | 'neutral' | 'negative';

export type DialogueVariant = {
  bracket: DialogueVariantBracket;
  liId: string;
  entrySceneId: string;
  scenes: DraftScene[];
};

export function parseDialogueVariant(raw: string): DialogueVariant {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`dialogue variant JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('dialogue variant must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.scenes) || !obj.entrySceneId) {
    throw new Error('dialogue variant missing scenes or entrySceneId');
  }

  const validBrackets: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];
  const bracket = String(obj.bracket ?? 'neutral') as DialogueVariantBracket;
  if (!validBrackets.includes(bracket)) {
    throw new Error(`invalid bracket "${obj.bracket}", expected one of: ${validBrackets.join(', ')}`);
  }

  const innerSegment = parseGeneratedSegment(raw);

  return {
    bracket,
    liId: String(obj.liId ?? ''),
    entrySceneId: innerSegment.entrySceneId,
    scenes: innerSegment.scenes,
  };
}

// ============================================================================
// ANCHOR BEAT (on-screen event scene of a story anchor)
// ============================================================================

export type AnchorBeatTransition = {
  /** Целевой якорь исходящего ребра. */
  toAnchorId: string;
  /** Диегетическая подпись действия игрока («Пойти в библиотеку»). */
  label: string;
};

export type AnchorBeat = {
  anchorId: string;
  /** 3-6 предложений от 2-го лица: событие якоря, разыгранное на экране. */
  beatText: string;
  transitions: AnchorBeatTransition[];
};

export function parseAnchorBeat(raw: string): AnchorBeat {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`anchor beat JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('anchor beat must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!obj.beatText || !Array.isArray(obj.transitions)) {
    throw new Error('anchor beat missing beatText or transitions');
  }

  const transitions: AnchorBeatTransition[] = (obj.transitions as unknown[]).map((t, i) => {
    const tr = t as Record<string, unknown>;
    if (!tr.toAnchorId) throw new Error(`transitions[${i}] missing toAnchorId`);
    return {
      toAnchorId: String(tr.toAnchorId),
      label: String(tr.label ?? ''),
    };
  });

  return {
    anchorId: String(obj.anchorId ?? ''),
    beatText: String(obj.beatText),
    transitions,
  };
}

export function validateAnchorBeat(beat: AnchorBeat, anchorId: string, outgoingAnchorIds: string[]): SegmentIssue[] {
  const issues: SegmentIssue[] = [];

  if (beat.anchorId !== anchorId) {
    issues.push({
      severity: 'error',
      scope: 'anchorId',
      message: `beat.anchorId "${beat.anchorId}" не совпадает с якорем "${anchorId}"`,
    });
  }

  if (beat.beatText.trim().length < 80) {
    issues.push({
      severity: 'error',
      scope: 'beatText',
      message: `beatText слишком короткий (${
        beat.beatText.trim().length
      } символов) для сцены-события — нужно 3-6 предложений`,
    });
  }

  const expected = new Set(outgoingAnchorIds);
  const got = new Set(beat.transitions.map(t => t.toAnchorId));
  for (const id of expected) {
    if (!got.has(id)) {
      issues.push({
        severity: 'error',
        scope: `transitions/${id}`,
        message: `нет перехода к исходящему якорю "${id}"`,
      });
    }
  }
  for (const id of got) {
    if (!expected.has(id)) {
      issues.push({
        severity: 'error',
        scope: `transitions/${id}`,
        message: `переход к "${id}" не соответствует ни одному исходящему ребру`,
      });
    }
  }

  const seenLabels = new Set<string>();
  for (const t of beat.transitions) {
    const label = t.label.trim();
    if (!label || label.length > 60 || /^[→\->]/.test(label)) {
      issues.push({
        severity: 'error',
        scope: `transitions/${t.toAnchorId}/label`,
        message: `label "${t.label}" пуст, длиннее 60 символов или начинается со стрелки — нужна диегетическая фраза с глагола`,
      });
    }
    const key = label.toLowerCase();
    if (seenLabels.has(key)) {
      issues.push({
        severity: 'warning',
        scope: `transitions/${t.toAnchorId}/label`,
        message: `label "${t.label}" дублирует другой переход`,
      });
    }
    seenLabels.add(key);
  }

  return issues;
}
