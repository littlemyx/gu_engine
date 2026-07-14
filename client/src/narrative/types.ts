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
  /**
   * Бюджет глобальных развилок хребта (branchPoint-битов), 0..3.
   * Ветка добавляет guard-ы по спайн-флагам, а не копии контента,
   * поэтому листьев ≤ 2^3, а объём растёт линейно.
   */
  branchPointBudget: number;
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

export type AnchorEdge = {
  from: string;
  to: string;
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

/** Глаголы общения в начале label перехода — признак «встречи», а не навигации. */
const TALK_VERB_RE = /^(по|за)?говорить|^спросить|^обратиться|^познакомиться/i;

export function validateAnchorBeat(
  beat: AnchorBeat,
  anchorId: string,
  outgoingAnchorIds: string[],
  liNames: string[] = [],
): SegmentIssue[] {
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
    // Переход — это навигация между этапами, а не запуск встречи: label с
    // именем персонажа или глаголом общения обещает диалог, которого не будет.
    const lower = label.toLowerCase();
    const mentionedLI = liNames.find(n => n && lower.includes(n.toLowerCase()));
    if (mentionedLI) {
      issues.push({
        severity: 'error',
        scope: `transitions/${t.toAnchorId}/label`,
        message: `label "${t.label}" упоминает персонажа "${mentionedLI}" — подпись перехода должна описывать перемещение, встречи происходят внутри этапа`,
      });
    }
    if (TALK_VERB_RE.test(label)) {
      issues.push({
        severity: 'error',
        scope: `transitions/${t.toAnchorId}/label`,
        message: `label "${t.label}" начинается с глагола общения — переход не запускает разговор, нужен глагол перемещения`,
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

// ============================================================================
// BEAT PLAN (relationship beats scheduled over encounter slots)
// ============================================================================

export type EncounterSlot = {
  anchorId: string;
  act: number;
  location: string;
  liIds: string[];
};

export type PlannedEncounter = {
  liId: string;
  anchorId: string;
  /** Размещённый required beat архетипа или null (обычная встреча-прогрессия). */
  beatType: BeatType | null;
  /** 1 предложение: что должно произойти между героями в эту встречу. */
  goal: string;
};

export type BeatPlan = {
  encounters: PlannedEncounter[];
  liArcs: { liId: string; arcSummary: string }[];
};

export function parseBeatPlan(raw: string): BeatPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`beat plan JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('beat plan must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.encounters) || !Array.isArray(obj.liArcs)) {
    throw new Error('beat plan missing encounters or liArcs');
  }

  const encounters: PlannedEncounter[] = (obj.encounters as unknown[]).map((e, i) => {
    const enc = e as Record<string, unknown>;
    if (!enc.liId || !enc.anchorId) {
      throw new Error(`encounters[${i}] missing liId or anchorId`);
    }
    return {
      liId: String(enc.liId),
      anchorId: String(enc.anchorId),
      beatType: enc.beatType ? (String(enc.beatType) as BeatType) : null,
      goal: String(enc.goal ?? ''),
    };
  });

  const liArcs = (obj.liArcs as unknown[]).map((a, i) => {
    const arc = a as Record<string, unknown>;
    if (!arc.liId) throw new Error(`liArcs[${i}] missing liId`);
    return { liId: String(arc.liId), arcSummary: String(arc.arcSummary ?? '') };
  });

  return { encounters, liArcs };
}

/**
 * Выбор-вопрос: литеральный («…нужна ли помощь?») или намерение спросить
 * («Спросить, нужна ли помощь», «Уточнить…», «Поинтересоваться…»).
 * Такой выбор обязан вести к сцене с ответом, а не завершать диалог.
 */
// \b тут не годится: в JS \w/\b — ASCII-семантика, для кириллицы границы
// слова нет никогда. Эмулируем границу через (?![а-яё]).
const QUESTION_INTENT_RE =
  /^(спросить|расспросить|переспросить|уточнить|поинтересоваться|узнать|выяснить|задать вопрос)(?![а-яё])/i;

export function isQuestionChoice(text: string): boolean {
  const t = text.trim();
  return t.endsWith('?') || QUESTION_INTENT_RE.test(t);
}

/**
 * Диалог обязан иметь выход: хотя бы один choice с nextSceneId === null.
 * Это условие критично для met-гейтинга повторных встреч — эффект
 * «встреча состоялась» вешается на выходные выборы диалога.
 */
export function validateDialogueVariant(variant: DialogueVariant): SegmentIssue[] {
  const issues: SegmentIssue[] = [];

  const sceneIds = new Set(variant.scenes.map(s => s.id));
  if (!sceneIds.has(variant.entrySceneId)) {
    issues.push({
      severity: 'error',
      scope: 'entry',
      message: `entrySceneId "${variant.entrySceneId}" не найден среди сцен`,
    });
  }

  const hasExitChoice = variant.scenes.some(s => s.choices.length === 0 || s.choices.some(c => c.nextSceneId === null));
  if (!hasExitChoice) {
    issues.push({
      severity: 'error',
      scope: 'exit',
      message: 'нет выхода из диалога — хотя бы один choice должен иметь nextSceneId: null',
    });
  }

  for (const scene of variant.scenes) {
    for (const choice of scene.choices) {
      if (choice.nextSceneId !== null && !sceneIds.has(choice.nextSceneId)) {
        issues.push({
          severity: 'error',
          scope: `${scene.id}/choice/${choice.id}`,
          message: `nextSceneId "${choice.nextSceneId}" не найден среди сцен диалога`,
        });
      }
      // Вопрос, завершающий диалог, оставляет игрока без ответа — выходные
      // реплики обязаны быть завершающими (прощание, закрытие темы).
      // Ловим и литеральный вопрос («...нужна ли помощь?»), и выбор-намерение
      // («Спросить, нужна ли помощь») — оба требуют сцены с ответом.
      if (choice.nextSceneId === null && isQuestionChoice(choice.text)) {
        issues.push({
          severity: 'error',
          scope: `${scene.id}/choice/${choice.id}`,
          message: `реплика-вопрос "${choice.text}" не может быть выходом из диалога — вопрос должен вести к сцене с ответом`,
        });
      }
    }
  }

  return issues;
}

// ============================================================================
// ENDING VARIANTS (epilogues routed by final state)
// ============================================================================

export type EndingScene = { id: string; narration: string };

export type EndingVariant = {
  kind: EndingKind;
  /** id LI для kind=good, null для normal/bad. */
  liId: string | null;
  scenes: EndingScene[];
};

/** Ключ концовки в сторе: good:<liId> | normal | bad. */
export function endingKey(kind: EndingKind, liId?: string | null): string {
  return kind === 'good' ? `good:${liId}` : kind;
}

export function parseEndingVariant(raw: string): EndingVariant {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`ending JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ending must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  const validKinds: EndingKind[] = ['good', 'normal', 'bad'];
  const kind = String(obj.kind ?? '') as EndingKind;
  if (!validKinds.includes(kind)) {
    throw new Error(`invalid ending kind "${obj.kind}"`);
  }
  if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) {
    throw new Error('ending missing scenes');
  }

  const scenes: EndingScene[] = (obj.scenes as unknown[]).map((sc, i) => {
    const scene = sc as Record<string, unknown>;
    if (!scene.narration) throw new Error(`scenes[${i}] missing narration`);
    return {
      id: String(scene.id ?? `ending_${kind}_${i + 1}`),
      narration: String(scene.narration),
    };
  });

  return {
    kind,
    liId: obj.liId ? String(obj.liId) : null,
    scenes,
  };
}

export function validateEndingVariant(variant: EndingVariant, expectedKind: EndingKind): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  if (variant.kind !== expectedKind) {
    issues.push({
      severity: 'error',
      scope: 'kind',
      message: `kind "${variant.kind}" не совпадает с запрошенным "${expectedKind}"`,
    });
  }
  if (variant.scenes.length < 1 || variant.scenes.length > 3) {
    issues.push({
      severity: 'error',
      scope: 'scenes',
      message: `сцен ${variant.scenes.length}, допускается 1-3`,
    });
  }
  for (const sc of variant.scenes) {
    if (sc.narration.trim().length < 60) {
      issues.push({
        severity: 'error',
        scope: `scenes/${sc.id}`,
        message: 'narration слишком короткий для сцены эпилога (нужно 3-6 предложений)',
      });
    }
  }
  return issues;
}

// ============================================================================
// WORLD MODEL (persistent locations registry with adjacency)
// ============================================================================

/**
 * Настроенческая характеристика локации → выбирает эмбиент-подложку из банка.
 * Конечный (но расширяемый) набор: гарантирует переиспользование бедов и не даёт
 * музыке разъехаться с визуалом (напр. дождливый универ = melancholic_sad, а не
 * задорная полька). Расширять = добавить ключ сюда + шаблон в MOOD_STYLE_TEMPLATES
 * (useBulkAudioGeneration.ts) + строку в промпт world-model (text_gen).
 */
export const LOCATION_MOODS = [
  'neutral_calm',
  'cheerful_warm',
  'cozy_tender',
  'romantic',
  'melancholic_sad',
  'wistful_nostalgic',
  'tense_anxious',
  'ominous_mysterious',
  'tragic_heavy',
] as const;

export type LocationMood = typeof LOCATION_MOODS[number];

/** Русские метки настроений для UI (селект локаций, превью аудио). */
export const LOCATION_MOOD_LABELS: Record<LocationMood, string> = {
  neutral_calm: 'нейтральная',
  cheerful_warm: 'весёлая',
  cozy_tender: 'уютная',
  romantic: 'романтическая',
  melancholic_sad: 'меланхоличная',
  wistful_nostalgic: 'ностальгическая',
  tense_anxious: 'тревожная',
  ominous_mysterious: 'зловещая',
  tragic_heavy: 'трагическая',
};

export const DEFAULT_LOCATION_MOOD: LocationMood = 'neutral_calm';

export function isLocationMood(v: unknown): v is LocationMood {
  return typeof v === 'string' && (LOCATION_MOODS as readonly string[]).includes(v);
}

/** Диегетические особые локации — дедикейтед эмбиент вместо mood-бакета (Phase 2). */
export const SPECIAL_AMBIENT_KINDS = [
  'bar_tavern',
  'party_club',
  'sports_stadium',
  'market_street',
  'ceremony',
] as const;

export type SpecialAmbientKind = typeof SPECIAL_AMBIENT_KINDS[number];

/** Русские метки особых локаций для UI. */
export const SPECIAL_AMBIENT_KIND_LABELS: Record<SpecialAmbientKind, string> = {
  bar_tavern: 'бар / таверна',
  party_club: 'вечеринка / клуб',
  sports_stadium: 'стадион',
  market_street: 'рынок / улица',
  ceremony: 'церемония',
};

export function isSpecialAmbientKind(v: unknown): v is SpecialAmbientKind {
  return typeof v === 'string' && (SPECIAL_AMBIENT_KINDS as readonly string[]).includes(v);
}

export type WorldLocation = {
  /** snake_case id: 'library', 'campus_alley'. */
  id: string;
  /** Человекочитаемое имя: «университетская библиотека». */
  name: string;
  /** Стабильное описание — общий контекст для всех генераторов. */
  description: string;
  /** 2-4 ключевые точки: «стол у окна», «стеллажи у входа». */
  pointsOfInterest: string[];
  /** Соседние локации и как до них добраться. */
  adjacent: { locationId: string; via: string }[];
  /** Настроение локации → эмбиент из банка. Дефолт neutral_calm. */
  mood: LocationMood;
  /** Особый диегетический эмбиент (бар/стадион/…). null = обычная mood-локация. */
  specialKind: SpecialAmbientKind | null;
};

export type WorldModel = {
  locations: WorldLocation[];
  /** anchorId -> locationId: где происходит каждый якорь outline. */
  anchorLocations: Record<string, string>;
};

export function parseWorldModel(raw: string): WorldModel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`world model JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('world model must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.locations) || !obj.anchorLocations || typeof obj.anchorLocations !== 'object') {
    throw new Error('world model missing locations or anchorLocations');
  }

  const locations: WorldLocation[] = (obj.locations as unknown[]).map((l, i) => {
    const loc = l as Record<string, unknown>;
    if (!loc.id || !loc.name) throw new Error(`locations[${i}] missing id or name`);
    return {
      id: String(loc.id),
      name: String(loc.name),
      description: String(loc.description ?? ''),
      pointsOfInterest: Array.isArray(loc.pointsOfInterest) ? (loc.pointsOfInterest as string[]).map(String) : [],
      adjacent: Array.isArray(loc.adjacent)
        ? (loc.adjacent as unknown[]).map(a => {
            const adj = a as Record<string, unknown>;
            return { locationId: String(adj.locationId ?? ''), via: String(adj.via ?? '') };
          })
        : [],
      // Косметические аудио-поля: неизвестный/пустой mood молча коэрсим к дефолту
      // (не роняем валидацию — автор поправит в UI). specialKind опционален.
      mood: isLocationMood(loc.mood) ? loc.mood : DEFAULT_LOCATION_MOOD,
      specialKind: isSpecialAmbientKind(loc.specialKind) ? loc.specialKind : null,
    };
  });

  const anchorLocations: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj.anchorLocations as Record<string, unknown>)) {
    anchorLocations[k] = String(v);
  }

  return { locations, anchorLocations };
}

export function validateWorldModel(world: WorldModel, outline: StoryOutlinePlan): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const locIds = new Set(world.locations.map(l => l.id));

  // Уникальность id.
  if (locIds.size !== world.locations.length) {
    const seen = new Set<string>();
    for (const l of world.locations) {
      if (seen.has(l.id)) {
        issues.push({ severity: 'error', scope: 'ids', message: `дублирующийся id локации "${l.id}"` });
      }
      seen.add(l.id);
    }
  }

  // Adjacency ссылается на существующие локации.
  for (const l of world.locations) {
    for (const a of l.adjacent) {
      if (!locIds.has(a.locationId)) {
        issues.push({
          severity: 'error',
          scope: `adjacent/${l.id}`,
          message: `adjacent ссылается на несуществующую локацию "${a.locationId}"`,
        });
      }
    }
  }

  // Все якоря замаплены на существующие локации.
  for (const anchor of outline.anchors) {
    const locId = world.anchorLocations[anchor.id];
    if (!locId) {
      issues.push({
        severity: 'error',
        scope: `anchors/${anchor.id}`,
        message: `якорь "${anchor.id}" не замаплен на локацию`,
      });
    } else if (!locIds.has(locId)) {
      issues.push({
        severity: 'error',
        scope: `anchors/${anchor.id}`,
        message: `якорь "${anchor.id}" замаплен на несуществующую локацию "${locId}"`,
      });
    }
  }

  // Для каждого outline-ребра существует путь в графе локаций (BFS,
  // adjacency трактуем как неориентированную).
  const neighbors = new Map<string, Set<string>>();
  for (const l of world.locations) {
    if (!neighbors.has(l.id)) neighbors.set(l.id, new Set());
    for (const a of l.adjacent) {
      if (!locIds.has(a.locationId)) continue;
      neighbors.get(l.id)!.add(a.locationId);
      if (!neighbors.has(a.locationId)) neighbors.set(a.locationId, new Set());
      neighbors.get(a.locationId)!.add(l.id);
    }
  }
  const reachableFrom = (start: string): Set<string> => {
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const n of neighbors.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return seen;
  };

  for (const edge of outline.anchorEdges) {
    const fromLoc = world.anchorLocations[edge.from];
    const toLoc = world.anchorLocations[edge.to];
    if (!fromLoc || !toLoc || !locIds.has(fromLoc) || !locIds.has(toLoc)) continue; // покрыто выше
    if (fromLoc === toLoc) continue;
    if (!reachableFrom(fromLoc).has(toLoc)) {
      issues.push({
        severity: 'error',
        scope: `route/${edge.from}->${edge.to}`,
        message: `нет пути между локациями "${fromLoc}" и "${toLoc}" — добавь adjacency`,
      });
    }
  }

  // Связность мира целиком (warning — изолированная локация подозрительна).
  if (world.locations.length > 1) {
    const seen = reachableFrom(world.locations[0].id);
    for (const l of world.locations) {
      if (!seen.has(l.id)) {
        issues.push({
          severity: 'warning',
          scope: `connectivity/${l.id}`,
          message: `локация "${l.id}" изолирована от остального мира`,
        });
      }
    }
  }

  return issues;
}
