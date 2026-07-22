/**
 * `.gu.json` v2 — storylet-бандл: то, что едет в билд игры.
 *
 * Отличие от v1 принципиальное. v1 вёз РАЗВЁРНУТЫЙ граф сцен: компилятор
 * заранее переводил guard-ы в численные условия рёбер, разворачивал хабы,
 * роутеры брекетов и цепочки продолжений, а движок ходил по узлам и брал
 * первое активное ребро. Знание «почему эта сцена уместна» при этом стиралось,
 * и адаптивности в момент игры не оставалось.
 *
 * v2 везёт ПУЛ юнитов с guard-ами и эффектами как есть. Движок в каждой точке
 * выбора фильтрует пул и ранжирует салиенс-селектором. Граф остаётся только
 * ВНУТРИ юнита — узлы реплик и выборов одной сцены.
 *
 * Проза, спрайты и аудио — пре-рендер: LLM отработала на этапе генерации,
 * в рантайме её нет. Состояние мутируют исключительно объявленные effects.
 */

import type { BracketThresholds } from './brackets';
import type { Effect } from './effects';
import type { Guard } from './guards';
import type { PhaseWindow, RelationshipState, SlotWindow } from './state';

export const STORY_BUNDLE_FORMAT_VERSION = 2;

/** Тон варианта диалога; совпадает с брекетами тона по построению. */
export type DialogueBracket = 'positive' | 'neutral' | 'negative';

export type RenderedSprite = { url: string; position: 'left' | 'center' | 'right' };

/** Строка сцены с уже разрешёнными спрайтами (пер-строчный трек эмоций). */
export type RenderedLine = { speaker?: string; text: string; sprites?: RenderedSprite[] };

export type SceneAudioProfile = {
  liId: string;
  positiveUrl?: string;
  negativeUrl?: string;
  positiveGte: number;
  negativeLte: number;
};

export type UnitChoice = {
  id: string;
  text: string;
  /** Собственные эффекты выбора. Движенческие живут на закрытии юнита. */
  effects: Effect[];
  /** id узла ВНУТРИ юнита. */
  next: string;
};

/** Узел внутреннего графа сцены; choices пуст → закрывающий узел. */
export type UnitSceneNode = {
  id: string;
  lines: RenderedLine[];
  choices: UnitChoice[];
};

/**
 * Вариант сцены под тон отношений. Выбирается В РАНТАЙМЕ по affection —
 * в v1 это была цепочка условных рёбер, где порядок проводки решал исход.
 */
export type UnitVariant = {
  bracket: DialogueBracket;
  entryNodeId: string;
  nodes: UnitSceneNode[];
  /** Прощание играется только при реальном уходе (не при продолжении). */
  farewell?: { lines: RenderedLine[] };
};

export type StoryletSource = 'spine' | 'agenda' | 'filler';

export type StoryletUnit = {
  id: string;
  /** Персонаж, к чьим отношениям относится сцена (ctx.x модели событий). */
  li: string;
  participants: string[];
  at: { locationId: string; slot: SlotWindow; phase?: PhaseWindow };
  /** Полная рекурсивная алгебра; гейты лестницы уже применены компилятором. */
  guard: Guard;
  /** Применяются при закрытии сцены: флаги ступени, гейн близости, вершина арки. */
  effectsOnClose: Effect[];
  arcStage?: number;
  source: StoryletSource;
  /** Базовый вес для селектора. */
  weight: number;
  /** Цель сцены — для отладочного HUD. */
  goal: string;
  variants: UnitVariant[];
  audioProfile?: SceneAudioProfile;
  sfxUrl?: string;
};

export type CompiledBeatOutcome = {
  id: string;
  /** Текст выбора игрока на развилке. */
  label: string;
  effects: Effect[];
};

export type CompiledBeat = {
  id: string;
  kind: 'beat' | 'branchPoint' | 'actGate' | 'finale';
  window: SlotWindow;
  locationId: string;
  participants: string[];
  guard: Guard;
  effects: Effect[];
  outcomes?: CompiledBeatOutcome[];
  text: string;
  background: string;
};

export type CompiledEnding = {
  id: string;
  kind: 'good' | 'normal' | 'bad';
  liId: string | null;
  /** Флаги хребта + пороги отношений уже запечены в guard. */
  guard: Guard;
  scenes: Array<{ text: string }>;
  background: string;
};

export type BundleCalendar = {
  days: number;
  dayparts: string[];
  slotCount: number;
  actBoundaries: number[];
  phasesPerSlot: number;
};

export type BundleLocation = {
  id: string;
  name: string;
  description: string;
  mood?: string;
  specialKind?: string;
  background: string;
};

export type BundleWorld = {
  locations: BundleLocation[];
  edges: Array<{ from: string; to: string; via?: string }>;
  startLocationId: string;
  /** Куда уводит сон. */
  homeLocationId: string;
};

export type BundleCastMember = {
  id: string;
  name: string;
  isLI: boolean;
  /** Пороги тона относительно старта архетипа — запечены на компиляции. */
  bracketThresholds: BracketThresholds;
};

export type BundleStateSchema = {
  /** Стартовые отношения по персонажам (дефолты архетипов). */
  relationships: Record<string, RelationshipState>;
  /** Объявленная вселенная флагов — для отладки и валидации. */
  flags: string[];
};

/** Якорный переход: единственный, кроме битов, двигатель большой стрелки. */
export type BundleAnchor = {
  daypartIndex: number;
  label: string;
  narration: string;
  /** Последняя часть дня: уводит домой и в утро. */
  isSleep: boolean;
};

export type SelectorWeights = {
  base: number;
  specificity: number;
  arcProgress: number;
  urgency: number;
  variety: number;
  pacing: number;
  source: number;
};

export type SelectorConfig = {
  /** Из скольких лучших кандидатов тянуть жребий; 1 = чистый argmax. */
  topN: number;
  weights: SelectorWeights;
  /** Штраф за того же персонажа в последних K закрытых сценах. */
  varietyWindow: number;
  seedPolicy: 'fixed' | 'random';
  fixedSeed?: number;
};

export type BundleAudio = {
  bgmUrl?: string;
  ambientByMood?: Record<string, string>;
  ambientBySpecial?: Record<string, string>;
  crossfadeDurationMs?: number;
  bgmVolume?: number;
  sfxVolume?: number;
};

export type BundleSettings = {
  sceneFadeInMs: number;
  sceneFadeOutMs: number;
  choiceAppearDelayMs: number;
  endFadeInMs: number;
};

export type StoryBundleV2 = {
  formatVersion: typeof STORY_BUNDLE_FORMAT_VERSION;
  title: string;
  meta: { generator: string; generatedAt?: string };
  stateSchema: BundleStateSchema;
  calendar: BundleCalendar;
  world: BundleWorld;
  cast: BundleCastMember[];
  /** char → локация в каждом слоте; детерминированная истина о присутствии. */
  schedule: Record<string, Array<string | null>>;
  units: StoryletUnit[];
  spine: { beats: CompiledBeat[]; endings: CompiledEnding[]; logline: string };
  anchors: BundleAnchor[];
  intro: { text: string; background: string };
  selector: SelectorConfig;
  audio: BundleAudio;
  settings: BundleSettings;
};

export const DEFAULT_SELECTOR_CONFIG: SelectorConfig = {
  topN: 3,
  varietyWindow: 2,
  seedPolicy: 'random',
  weights: {
    // Сюжет обязан вытеснять болтовню, а ступень арки — филлер: без этого
    // взвешенный жребий разбавляет дугу и лестница не набирает высоту.
    base: 1,
    specificity: 0.5,
    arcProgress: 3,
    urgency: 2,
    variety: 1.5,
    pacing: 0.5,
    source: 2,
  },
};

export const DEFAULT_BUNDLE_SETTINGS: BundleSettings = {
  sceneFadeInMs: 600,
  sceneFadeOutMs: 400,
  choiceAppearDelayMs: 120,
  endFadeInMs: 400,
};

export type BundleValidationIssue = { severity: 'error' | 'warning'; message: string };

/**
 * Структурная проверка бандла на входе движка. Не заменяет story QA: ловит
 * то, от чего рантайм упадёт или молча потеряет контент — недостающие
 * локации, сцены без входного узла, ссылки выборов в никуда.
 */
export function validateStoryBundle(bundle: StoryBundleV2): BundleValidationIssue[] {
  const issues: BundleValidationIssue[] = [];
  const err = (message: string) => issues.push({ severity: 'error', message });
  const warn = (message: string) => issues.push({ severity: 'warning', message });

  if (bundle.formatVersion !== STORY_BUNDLE_FORMAT_VERSION) {
    err(`formatVersion ${bundle.formatVersion} — движок понимает только ${STORY_BUNDLE_FORMAT_VERSION}`);
    return issues;
  }

  const locIds = new Set(bundle.world.locations.map(l => l.id));
  if (locIds.size === 0) err('в мире нет локаций');
  if (!locIds.has(bundle.world.startLocationId)) err(`стартовая локация "${bundle.world.startLocationId}" не найдена`);
  if (!locIds.has(bundle.world.homeLocationId)) err(`домашняя локация "${bundle.world.homeLocationId}" не найдена`);

  if (bundle.calendar.slotCount <= 0) err('пустой календарь');
  if (bundle.calendar.dayparts.length === 0) err('в календаре нет частей дня');
  if (bundle.anchors.length !== bundle.calendar.dayparts.length) {
    // Якорь на каждую часть дня — анти-софтлок: без него игрок, попавший в
    // непокрытую часть дня, застревает навсегда (время двигают только сюжет и якоря).
    err(`якорей ${bundle.anchors.length}, частей дня ${bundle.calendar.dayparts.length} — возможен софтлок`);
  }

  const castIds = new Set(bundle.cast.map(c => c.id));
  for (const unit of bundle.units) {
    const where = `юнит "${unit.id}"`;
    if (!locIds.has(unit.at.locationId)) err(`${where}: локация "${unit.at.locationId}" не найдена`);
    if (unit.li && !castIds.has(unit.li)) warn(`${where}: персонаж "${unit.li}" вне каста`);
    if (unit.variants.length === 0) {
      err(`${where}: нет ни одного варианта сцены`);
      continue;
    }
    if (!unit.variants.some(v => v.bracket === 'neutral')) {
      // Нейтральный вариант — гарантированный фолбэк выбора тона.
      warn(`${where}: нет нейтрального варианта — при среднем тоне сцена может не открыться`);
    }
    for (const v of unit.variants) {
      const nodeIds = new Set(v.nodes.map(n => n.id));
      if (!nodeIds.has(v.entryNodeId)) err(`${where} (${v.bracket}): входной узел "${v.entryNodeId}" отсутствует`);
      if (!v.nodes.some(n => n.choices.length === 0)) {
        err(`${where} (${v.bracket}): нет закрывающего узла — сцена не кончится`);
      }
      for (const n of v.nodes) {
        for (const c of n.choices) {
          if (!nodeIds.has(c.next)) err(`${where} (${v.bracket}): выбор "${c.id}" ведёт в несуществующий "${c.next}"`);
        }
      }
    }
  }

  for (const beat of bundle.spine.beats) {
    if (!locIds.has(beat.locationId)) err(`бит "${beat.id}": локация "${beat.locationId}" не найдена`);
  }
  if (!bundle.spine.beats.some(b => b.kind === 'finale')) warn('в хребте нет финала');
  if (bundle.spine.endings.length === 0) warn('нет ни одной концовки');

  return issues;
}
