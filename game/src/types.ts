/**
 * Типы движка. Графовая схема сцен (узлы, рёбра, численные условия,
 * ProjectFile/ResolvedProject) снесена вместе с обходчиком графа: движок
 * читает storylet-бандл, чьи типы объявлены в общем ядре
 * (gu-engine-story-core). Здесь остались только те, что нужны ВИДУ —
 * рендереру и карте, которым всё равно, кто поставляет кадр.
 */

export type SceneType = "narration" | "dialogue" | "branch" | "router" | "anchor";

export type SpriteEntry = {
  url: string;
  position: "left" | "center" | "right";
};

/** Строка сцены с уже разрешёнными спрайтами. */
export type SceneLineEntry = {
  speaker?: string;
  text: string;
  sprites?: SpriteEntry[];
};

export type SceneAudioProfile = {
  liId: string;
  positiveUrl?: string;
  negativeUrl?: string;
  positiveGte: number;
  negativeLte: number;
};

export type SceneOutput = {
  id: string;
  text: string;
};

export type SceneNodeData = {
  label: string;
  image: string;
  /** @deprecated Use sprites[] for multi-character. */
  sprite?: string;
  sprites?: SpriteEntry[];
  lines?: SceneLineEntry[];
  outputs: SceneOutput[];
  sceneType?: SceneType;
  audioProfile?: SceneAudioProfile;
  sfxUrl?: string;
};

/** Кадр для рендерера — чистая view-модель, а не узел графа. */
export type SceneNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: SceneNodeData;
};

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

/** Календарь игры: слот = (день × часть дня). Эмитится
 *  сборщиком бандла (client/src/narrative/buildStoryletBundle.ts) в
 *  settings.calendar. Отсутствует → HUD календаря скрыт. */
export type CalendarSettings = {
  /** Всего слотов; переменная движка slot живёт в [0, slotCount]. */
  slotCount: number;
  /** Названия частей дня; длина = слотов в дне. */
  dayparts: string[];
  /** День начала каждого акта; actBoundaries[0] === 0. */
  actBoundaries: number[];
  /**
   * Фаз внутри части дня (малая стрелка). Разговоры тратят фазу, часть дня
   * двигают только сюжет и якорные переходы. Поля нет — игра собрана до
   * реформы времени: фаз не существует, HUD показывает только часть дня.
   */
  phasesPerSlot?: number;
};

export type ProjectSettings = {
  sceneFadeInMs: number;
  sceneFadeOutMs: number;
  choiceAppearDelayMs: number;
  endFadeInMs: number;
  world?: WorldManifest;
  calendar?: CalendarSettings;
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
