export type SceneType = 'narration' | 'dialogue' | 'branch' | 'router' | 'anchor';

export type OutputEffects = {
  stateDeltas?: Record<string, number>;
  flagSet?: string[];
  flagClear?: string[];
};

export type SceneOutput = {
  id: string;
  text: string;
  effects?: OutputEffects;
};

export type SpriteEntry = {
  url: string;
  position: 'left' | 'center' | 'right';
};

/**
 * Аудио-профиль encounter-сцены. Пороги копируются компилятором мира из
 * bracketCondition-констант — музыкальный тон совпадает с диалоговым
 * bracket-ом по построению. Негатив — по affection (не tension), как в
 * диалогах.
 */
export type SceneAudioProfile = {
  liId: string;
  positiveUrl?: string;
  negativeUrl?: string;
  positiveGte: number;
  negativeLte: number;
};

export type SceneNodeData = {
  label: string;
  image: string;
  /** @deprecated Use sprites[] for multi-character. Kept for backward compat. */
  sprite?: string;
  sprites?: SpriteEntry[];
  outputs: SceneOutput[];
  sceneType?: SceneType;
  audioProfile?: SceneAudioProfile;
  /** SFX сцены, разрешён по эмоции на этапе конверсии (emotionResolver). */
  sfxUrl?: string;
};

export type SceneNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: SceneNodeData;
};

export type StateCondition = {
  path: string;
  gte?: number;
  lte?: number;
};

export type SceneEdge = {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  condition?: StateCondition[];
};

export type SceneGraph = {
  nodes: SceneNode[];
  edges: SceneEdge[];
};

export type StateVarSchema = {
  range: [number, number];
  default: number;
};

export type StateSchema = {
  vars: Record<string, StateVarSchema>;
  flags: string[];
};

/** Компактный манифест мира для карты в игре. Эмитится компилятором
 *  (client/src/narrative/compileWorldGame.ts) в settings.world. Отсутствует →
 *  кнопка карты в плеере скрыта. */
export type WorldMapLocation = {
  id: string;
  name: string;
  /** Настроение локации → выбор эмбиент-беда из settings.ambientByMood. */
  mood?: string;
  /** Особый диегетический эмбиент → settings.ambientBySpecial (приоритет над mood). */
  specialKind?: string;
};

export type WorldMapEdge = {
  from: string;
  to: string;
  via?: string;
};

export type WorldManifest = {
  locations: WorldMapLocation[];
  edges: WorldMapEdge[];
};

export type ProjectSettings = {
  sceneFadeInMs: number;
  sceneFadeOutMs: number;
  choiceAppearDelayMs: number;
  endFadeInMs: number;
  stateSchema?: StateSchema;
  world?: WorldManifest;
  /** Базовая мелодия проекта — играет во всех сценах без audioProfile. */
  bgmUrl?: string;
  /**
   * Банк эмбиентов по настроению локации: LocationMood → URL. Рендерер выбирает
   * подложку по mood текущей локации; bgmUrl остаётся фолбэком.
   */
  ambientByMood?: Record<string, string>;
  /** Диегетические беды особых локаций: SpecialAmbientKind → URL (приоритет над mood). */
  ambientBySpecial?: Record<string, string>;
  crossfadeDurationMs?: number;
  bgmVolume?: number;
  sfxVolume?: number;
};

export type ProjectFile = {
  title: string;
  scenes: string;
  settings: Partial<ProjectSettings>;
};

export type ResolvedProject = {
  title: string;
  scenes: SceneGraph;
  projectFile?: string;
  scenesFile?: string;
  settings: ProjectSettings;
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  sceneFadeInMs: 600,
  sceneFadeOutMs: 400,
  choiceAppearDelayMs: 120,
  endFadeInMs: 400,
};
