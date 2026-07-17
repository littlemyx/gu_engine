import type { EndingKind } from './types';
import type { EventDef, Guard, PhaseWindow, SlotWindow } from './events';

export type { PhaseWindow, SlotWindow } from './events';

/**
 * Календарная модель истории: время как первоклассная дискретная ось.
 *
 * Слот = (день, время суток), кодируется единым integer
 * `slot = day * dayparts.length + daypartIndex` — ложится на численные
 * условия движка {path, gte, lte} без изменений engine.
 *
 * Замена конфляции «срез времени = якорь outline»: биты хребта (SpineBeat)
 * несут ОКНО слотов, а не пришпилены к слоту; персонажи размещаются по
 * локациям расписанием (CharacterSchedule), так что в один слот живут
 * несколько локаций с событиями и игрок выбирает, куда пойти.
 *
 * План: docs/plans/calendar-branching.md
 */

// ============================================================================
// CALENDAR
// ============================================================================

export const DEFAULT_DAYPARTS = ['утро', 'день', 'вечер'];

export type Calendar = {
  days: number;
  /** Названия частей дня; длина = слотов в дне. */
  dayparts: string[];
  /** days * dayparts.length. */
  slotCount: number;
  /** День начала каждого акта; actBoundaries[0] === 0, монотонно возрастает. */
  actBoundaries: number[];
  /** Особые дни (фестиваль и т.п.) — колорит для промптов и монтажки. */
  specialDays?: { day: number; label: string }[];
};

export const slotOf = (day: number, daypartIndex: number, daypartsPerDay: number): number =>
  day * daypartsPerDay + daypartIndex;

export const dayOfSlot = (slot: number, cal: Calendar): number => Math.floor(slot / cal.dayparts.length);

export const daypartOfSlot = (slot: number, cal: Calendar): string => cal.dayparts[slot % cal.dayparts.length] ?? '';

/** «день 3 · вечер» (день 1-based для человека). */
export const slotLabel = (slot: number, cal: Calendar): string =>
  `день ${dayOfSlot(slot, cal) + 1} · ${daypartOfSlot(slot, cal)}`;

/**
 * Маркер времени по ВСЕМУ окну встречи — то, что честно знает про неё проза.
 *
 * Живой плейтест: Асель говорила «Доброе утро» в ДЕНЬ 1 · ВЕЧЕР. Причина не в
 * модели — маркер строился по ПЕРВОМУ слоту окна, и про остальные проза просто
 * не знала. Окно шире одной части дня → время суток не определено, и приветствие
 * по нему писать нельзя; об этом промпт и предупреждаем явно.
 */
export function windowTimeMarker(window: SlotWindow, cal: Calendar): string {
  const from = Math.max(0, Math.trunc(window.fromSlot));
  const to = Math.max(from, Math.trunc(window.toSlot));
  const dayparts = new Set<string>();
  for (let s = from; s <= to; s++) dayparts.add(daypartOfSlot(s, cal));
  if (dayparts.size === 1) return slotLabel(from, cal);

  const dayFrom = dayOfSlot(from, cal) + 1;
  const dayTo = dayOfSlot(to, cal) + 1;
  const days = dayFrom === dayTo ? `день ${dayFrom}` : `дни ${dayFrom}–${dayTo}`;
  return `${days} · время суток РАЗНОЕ (${[...dayparts].join('/')}) — точный момент неизвестен`;
}

/** Акт слота по границам дней; акты 1-based. */
export function actOfSlot(slot: number, cal: Calendar): number {
  const day = dayOfSlot(slot, cal);
  let act = 1;
  for (let i = 1; i < cal.actBoundaries.length; i++) {
    if (day >= cal.actBoundaries[i]) act = i + 1;
  }
  return act;
}

/** Окно слотов акта [fromSlot, toSlot] включительно. */
export function actSlotWindow(act: number, cal: Calendar): SlotWindow {
  const perDay = cal.dayparts.length;
  const fromDay = cal.actBoundaries[act - 1] ?? 0;
  const toDay = act < cal.actBoundaries.length ? cal.actBoundaries[act] - 1 : cal.days - 1;
  return { fromSlot: fromDay * perDay, toSlot: toDay * perDay + perDay - 1 };
}

/**
 * Эффективное окно бита для планирования и рантайма: расширяется до окна его
 * акта (объединение с исходным окном LLM, клампится к календарю).
 *
 * Зачем: потребление бита двигает стрелу времени `slot+1`, а компилятор гейтит
 * бит прямо по окну (`slot ∈ [from,to]`). Вырожденное однослотовое окно от LLM
 * ([6,6]) делает НЕСКОЛЬКО одновременных (co-play) битов непроигрываемыми —
 * сыграв первый, стрела уходит из окна остальных. Окно на весь акт даёт
 * планировщику/движку свободу расставить co-play биты по разным слотам акта;
 * порядок внутри акта держат флаговые guard-ы, а не узость окна.
 */
export function effectiveBeatWindow(beat: SpineBeat, cal: Calendar): SlotWindow {
  const lastSlot = cal.slotCount - 1;
  const actCount = cal.actBoundaries.length;
  const act = Math.min(Math.max(1, beat.act), Math.max(1, actCount));
  const aw = actSlotWindow(act, cal);
  const from = Math.max(0, Math.min(aw.fromSlot, beat.window.fromSlot));
  const to = Math.min(lastSlot, Math.max(aw.toSlot, beat.window.toSlot));
  return { fromSlot: Math.min(from, to), toSlot: Math.max(from, to) };
}

/**
 * Нормализация хребта: каждому биту — эффективное окно (см. effectiveBeatWindow).
 * Применяется ПЕРЕД валидацией и сохранением хребта, чтобы компилятор,
 * reachability, расписание и story QA видели одни и те же проигрываемые окна.
 * Идемпотентна.
 */
export function normalizeSpineWindows(spine: SpinePlan, cal: Calendar): SpinePlan {
  return { ...spine, beats: spine.beats.map(b => ({ ...b, window: effectiveBeatWindow(b, cal) })) };
}

const MINUTES_PER_SLOT = 3;
const MIN_SLOTS = 9;
const MAX_SLOTS = 36;

export type CalendarTargets = {
  slotCount: number;
  days: number;
  daypartsPerDay: number;
};

/**
 * Целевые размеры календаря из brief.scale — родственник computeOutlineTargets
 * (~3 минуты игры на слот: выбор локации + событие/диалог).
 */
export function computeCalendarTargets(targetDurationMinutes: number): CalendarTargets {
  const daypartsPerDay = DEFAULT_DAYPARTS.length;
  const raw = Math.round(targetDurationMinutes / MINUTES_PER_SLOT);
  const clamped = Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, raw));
  // Округляем вверх до целых дней — календарь без «огрызка» дня.
  const days = Math.ceil(clamped / daypartsPerDay);
  return { slotCount: days * daypartsPerDay, days, daypartsPerDay };
}

// ============================================================================
// ЛЕСТНИЦА ОТНОШЕНИЙ (чистая математика + балансовые константы)
// ============================================================================
//
// Арка LI — лестница из N ступеней близости вместо жёсткой тройки
// «знакомство → уязвимость → признание»: трёхступенчатая арка на коротком
// календаре давала скачок «вчера познакомились — сегодня романтический
// конфликт». Ступени гейтятся движком по f(z, R, H): полы окон (z),
// rel-пороги (R), fired-цепочки и one-shot встречи (H).
//
// Все балансовые константы живут здесь одной точкой — тюнинг после живого
// плейтеста должен быть правкой одной строки, а не раскопками по модулям.

/** Потолок rel-порогов лестницы: выше только клампы движка. */
export const LADDER_AFFECTION_CEIL = 0.85;
/** Доля шага ступени, которую гарантирует closing встречи (детерминированно). */
export const LADDER_CLOSING_SHARE = 0.5;
/** Жёсткий кламп |дельты| одного выбора в диалоге (parser + валидатор). */
export const CHOICE_DELTA_BOUND = 0.1;
/** Кап суммы дельт по ЛЮБОМУ пути root→closing (на var) — анти-гринд. */
export const CHOICE_PATH_DELTA_CAP = 0.15;
/** Гейн филлера-восстановления (догоняющий канал холодного пути). */
export const FILLER_RECOVERY_DELTA = 0.04;

// ── Малые часы: фазы внутри части дня ───────────────────────────────────────
//
// Большая стрелка (slot = день × часть дня) двигается ТОЛЬКО сюжетом: битами
// хребта и якорными переходами («пойти спать»). Разговоры её не крутят —
// плейтест показал, во что это выливается: беседа начиналась вечером, а после
// прощания наступало утро, и ночь исчезала как побочный эффект.
//
// Малая стрелка — часы САМОГО СЛОТА, а не бюджет действий игрока. Разговор
// расходует фазу; к поздней фазе персонаж «менее восприимчив» — глубокие ветки
// закрываются, остаются сюжетные. Дефицит создаёт мир (люди заняты), а не
// счётчик очков: игрок не видит числа, он видит, что человек уже не тот.

/** Фаз в одной части дня: «первая половина / вторая половина». */
export const PHASES_PER_SLOT = 2;

/** Когда в пределах части дня уместен разговор — семантика от смысла сцены. */
export type UnitTiming = 'early' | 'late' | 'any';

/**
 * Окно фаз по семантике контента.
 *
 * Восприимчивость — свойство СЦЕНЫ, а не позиции в слоте: «подбодрить
 * вымотанную к концу смены» обязано открываться именно поздно, и жёсткое
 * «глубокое — только на свежую голову» такую арку бы запретило. Поэтому окно
 * выбирает генерация (поле timing у юнита), а лестница даёт лишь дефолт.
 */
export function phaseWindowForTiming(timing: UnitTiming): PhaseWindow {
  const last = Math.max(0, PHASES_PER_SLOT - 1);
  if (timing === 'early') return { fromPhase: 0, toPhase: 0 };
  if (timing === 'late') return { fromPhase: last, toPhase: last };
  return { fromPhase: 0, toPhase: last };
}

/**
 * ДЕФОЛТ окна фаз для ступени s — когда генерация timing не указала.
 *
 * Ступень 1 и филлеры («поболтать») уместны в любой момент части дня; глубокий
 * разговор ступени ≥2 по умолчанию требует свежей фазы. Это именно дефолт:
 * собственный timing юнита его не перетирает (см. applyLadderGuards).
 */
export function phaseWindowForStage(stage: number): PhaseWindow {
  return phaseWindowForTiming(stage >= 2 ? 'early' : 'any');
}

/** Подпись кнопки + нарация якорного перехода (ключ — индекс части дня). */
export type AnchorNarration = { label: string; narration: string };
export type AnchorNarrations = Record<number, AnchorNarration>;

/**
 * Парсер стадии anchorTransition. Терпим: мусорная запись отбрасывается, а не
 * роняет стадию — у компилятора есть статичные фолбэки, и история играбельна
 * даже с пустым результатом.
 */
export function parseAnchorTransitions(rawText: string, daypartCount: number): AnchorNarrations {
  const parsed = JSON.parse(rawText) as { transitions?: unknown };
  if (!Array.isArray(parsed.transitions)) throw new Error('anchorTransition missing transitions[]');
  const out: AnchorNarrations = {};
  for (const t of parsed.transitions as Record<string, unknown>[]) {
    const idx = Number(t?.daypartIndex);
    const label = String(t?.label ?? '').trim();
    const narration = String(t?.narration ?? '').trim();
    if (!Number.isInteger(idx) || idx < 0 || idx >= daypartCount || !label || !narration) continue;
    out[idx] = { label, narration };
  }
  return out;
}

/** Число ступеней арки от длины истории: 3 дня → 4, 4 → 5, 12 → 9 (потолок). */
export function arcStageCount(days: number): number {
  return Math.min(9, Math.max(3, Math.trunc(days) + 1));
}

/** Обязательные ступени 1..N (контракт castPlan/eventPool). */
export function requiredArcStages(stageCount: number): number[] {
  return Array.from({ length: Math.max(1, Math.trunc(stageCount)) }, (_, i) => i + 1);
}

/**
 * Rel-порог входа на ступень s: линейный подъём от старта архетипа (A0 =
 * середина initialState.affection — то же значение, что дефолт stateSchema)
 * к потолку. Headroom-relative: у «тёплых» архетипов (forbidden 0.5,
 * mutual_pining 0.6) ступени НЕ вырождаются у потолка — шаг равномерно
 * делит оставшийся запас, а не глобальную шкалу.
 */
export function ladderThreshold(a0: number, stage: number, stageCount: number): number {
  if (stageCount <= 1) return a0;
  const step = Math.max(0, LADDER_AFFECTION_CEIL - a0) / (stageCount - 1);
  return Math.min(LADDER_AFFECTION_CEIL, a0 + (Math.max(1, stage) - 1) * step);
}

/**
 * Пол дня ступени: раньше этого дня ступень s не играется, сколько бы
 * affection ни набрали. «Надо переспать с мыслью» — статикой по календарю,
 * без расширения Guard-грамматики. floor(((s−1)/N)·days): ступени 1-2 —
 * день 0, дальше ~по ступени в день; последняя ступень — последний день.
 */
export function stageFloorDay(stage: number, stageCount: number, days: number): number {
  if (stageCount <= 0 || days <= 0) return 0;
  return Math.max(0, Math.floor(((Math.max(1, stage) - 1) / stageCount) * days));
}

/** Пол в слотах (первый слот дня-пола). */
export function stageFloorSlot(stage: number, stageCount: number, cal: Calendar): number {
  return stageFloorDay(stage, stageCount, cal.days) * cal.dayparts.length;
}

/**
 * Детерминированный гейн closing-а встречи ступени s.
 *
 * Валюта арки НЕ доверяется LLM: жирные значения фармились бы холодной
 * прогонкой, нулевые запирали бы лестницу навсегда. Гейн держит ДВА инварианта:
 *
 *   closing + CHOICE_PATH_DELTA_CAP ≥ шаг — тёплый разговор ОТКРЫВАЕТ следующую
 *     ступень. Фиксированной доли для этого мало: при крупных шагах (N=3,
 *     A0=0.2 → шаг 0.325) половина + выборы дают 0.31 < 0.325, и прилежный
 *     игрок упирался бы в стену;
 *   closing < шаг — холодная прогонка ОДНИМИ встречами не поднимает: подъём
 *     обязан стоить игроку тёплых выборов, иначе ступень берётся молчанием.
 */
export function ladderClosingGain(a0: number, stage: number, stageCount: number): number {
  const s = Math.max(1, Math.min(stage, stageCount));
  const next = Math.min(s + 1, stageCount);
  const step = ladderThreshold(a0, next, stageCount) - ladderThreshold(a0, s, stageCount);
  if (step <= 0) return 0;
  // Верхняя граница строго ниже шага — иначе холодный игрок поднимался бы даром.
  return Math.min(step * 0.99, Math.max(LADDER_CLOSING_SHARE * step, step - CHOICE_PATH_DELTA_CAP));
}

// ============================================================================
// CAST PLAN (проход A1: персоны + цели + weekly-паттерны по тегам локаций)
// ============================================================================

export type LocationTag = string;

export type CastGoal = {
  id: string;
  description: string;
  /** Стадия арки 1..N — упорядочивает цели персонажа во времени. */
  arcStage: number;
};

export type CastAgenda = {
  goals: CastGoal[];
  /**
   * Каким ЭТОТ персонаж видит идеал отношений и что для него — худший исход.
   * У каждого своё: арка близости персонализирована, а не общая лестница.
   * Кормит прозу концовок и тон поздних ступеней. Опционально — персистнутые
   * агенды без этих полей грузятся как есть.
   */
  idealRelationship?: string;
  worstRelationship?: string;
  /**
   * daypart → взвешенные теги локаций («где персонаж обычно бывает утром»).
   * Теги абстрактные (workplace/hangout/home) — на конкретные локации их
   * маппит tagMap стадии worldCalendar.
   */
  weeklyPattern: Record<string, { tag: LocationTag; weight: number }[]>;
  /** Описания тегов — контекст для маппинга и промптов. */
  locationTags: Record<LocationTag, string>;
};

export type CastMember = {
  id: string;
  isLI: boolean;
  agenda: CastAgenda;
};

export type CastPlan = { members: CastMember[] };

// ============================================================================
// SPINE (хребет истории: биты с окнами, развилки, концовки)
// ============================================================================

export type SpineBeatKind = 'beat' | 'branchPoint' | 'actGate' | 'finale';

export type SpineBeatOutcome = {
  id: string;
  /** Текст выбора игрока в сцене развилки. */
  label: string;
  /** Спайн-флаг, который ставит исход (guard-ы контента его проверяют). */
  setsFlag: string;
  summary: string;
};

export type SpineBeat = {
  id: string;
  kind: SpineBeatKind;
  act: number;
  window: SlotWindow;
  locationId: string;
  /** id персонажей; допустимы плейсхолдеры ролей ("$closestLI"). */
  participants: string[];
  summary: string;
  /** Флаги, становящиеся истинными после бита. */
  establishes: string[];
  /** «Если» — предикат допуска бита (флаговые зависимости, ветки). */
  guard: Guard;
  /** Только для kind=branchPoint: 2-3 исхода. */
  outcomes?: SpineBeatOutcome[];
};

export type SpineEnding = {
  id: string;
  kind: EndingKind;
  /** id LI для kind=good, null для normal/bad. */
  liId: string | null;
  guard: Guard;
};

export type SpinePlan = {
  title: string;
  logline: string;
  beats: SpineBeat[];
  endings: SpineEnding[];
};

// ============================================================================
// SCHEDULE + EVENT POOL
// ============================================================================

/** char → позиция в каждом слоте; null = за кадром. Длина массива = slotCount. */
export type CharacterSchedule = Record<string, (string | null)[]>;

export type EventUnitSource = 'spine' | 'agenda' | 'filler';

/** Событие-storylet: guard+goal+effects; проза генерируется отдельно и лениво. */
export type EventUnit = EventDef & {
  goal: string;
  arcStage?: number;
  source: EventUnitSource;
};

// ============================================================================
// PARSERS (LLM JSON → типы; в стиле parseStoryOutline)
// ============================================================================

/**
 * LLM-контракт guard-ов плоский: {requires: string[]} (AND по флагам) вместо
 * рекурсивной грамматики Guard — надёжнее для JSON-генерации. Внутрь модели
 * событий превращаем здесь.
 */
export function guardFromRequires(requires: string[]): Guard {
  const flags = requires.filter(Boolean).map(f => ({ flag: String(f) } as Guard));
  return { all: flags };
}

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : []);

function parseWindow(raw: unknown, ctx: string): SlotWindow {
  const w = (raw ?? {}) as Record<string, unknown>;
  const from = Number(w.fromSlot);
  const to = Number(w.toSlot);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error(`${ctx}: window.fromSlot/toSlot must be numbers`);
  }
  return { fromSlot: Math.trunc(from), toSlot: Math.trunc(to) };
}

export function parseCalendar(raw: unknown): Calendar {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const dayparts = asStringArray(obj.dayparts);
  const days = Number(obj.days);
  if (!Number.isFinite(days) || days <= 0) throw new Error('calendar.days must be a positive number');
  if (dayparts.length === 0) throw new Error('calendar.dayparts must be a non-empty array');
  const actBoundaries = Array.isArray(obj.actBoundaries) ? obj.actBoundaries.map(n => Math.trunc(Number(n))) : [];
  if (actBoundaries.length === 0 || actBoundaries[0] !== 0) {
    throw new Error('calendar.actBoundaries must start with 0');
  }
  return {
    days: Math.trunc(days),
    dayparts,
    slotCount: Math.trunc(days) * dayparts.length,
    actBoundaries,
    specialDays: Array.isArray(obj.specialDays)
      ? (obj.specialDays as unknown[]).map(sd => {
          const s = sd as Record<string, unknown>;
          return { day: Math.trunc(Number(s.day ?? 0)), label: String(s.label ?? '') };
        })
      : undefined,
  };
}

const VALID_BEAT_KINDS: SpineBeatKind[] = ['beat', 'branchPoint', 'actGate', 'finale'];

export function parseSpinePlan(rawText: string): SpinePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`spine JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (!Array.isArray(obj.beats)) throw new Error('spine missing required array: beats');

  const beats: SpineBeat[] = (obj.beats as unknown[]).map((b, i) => {
    const beat = b as Record<string, unknown>;
    if (!beat.id) throw new Error(`beats[${i}] missing required field: id`);
    const kind = String(beat.kind ?? 'beat') as SpineBeatKind;
    if (!VALID_BEAT_KINDS.includes(kind)) {
      throw new Error(`beats[${i}] invalid kind "${beat.kind}", expected one of: ${VALID_BEAT_KINDS.join(', ')}`);
    }
    if (!beat.locationId || typeof beat.locationId !== 'string') {
      throw new Error(`beats[${i}] missing required field: locationId`);
    }
    const outcomes = Array.isArray(beat.outcomes)
      ? (beat.outcomes as unknown[]).map((o, j) => {
          const out = o as Record<string, unknown>;
          if (!out.id || !out.setsFlag) {
            throw new Error(`beats[${i}].outcomes[${j}] missing required fields (id/setsFlag)`);
          }
          return {
            id: String(out.id),
            label: String(out.label ?? ''),
            setsFlag: String(out.setsFlag),
            summary: String(out.summary ?? ''),
          };
        })
      : undefined;
    return {
      id: String(beat.id),
      kind,
      act: typeof beat.act === 'number' ? beat.act : 1,
      window: parseWindow(beat.window, `beats[${i}]`),
      locationId: String(beat.locationId),
      participants: asStringArray(beat.participants),
      summary: String(beat.summary ?? ''),
      establishes: asStringArray(beat.establishes),
      guard: guardFromRequires(asStringArray(beat.requires)),
      outcomes,
    };
  });

  const validEndingKinds: EndingKind[] = ['good', 'normal', 'bad'];
  const endings: SpineEnding[] = Array.isArray(obj.endings)
    ? (obj.endings as unknown[]).map((e, i) => {
        const end = e as Record<string, unknown>;
        const kind = String(end.kind ?? '') as EndingKind;
        if (!validEndingKinds.includes(kind)) {
          throw new Error(`endings[${i}] invalid kind "${end.kind}"`);
        }
        return {
          id: String(end.id ?? `ending_${i + 1}`),
          kind,
          liId: end.liId ? String(end.liId) : null,
          guard: guardFromRequires(asStringArray(end.requires)),
        };
      })
    : [];

  return {
    title: String(obj.title ?? ''),
    logline: String(obj.logline ?? ''),
    beats,
    endings,
  };
}

export function parseCastPlan(rawText: string): CastPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`castPlan JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (!Array.isArray(obj.members)) throw new Error('castPlan missing required array: members');

  const members: CastMember[] = (obj.members as unknown[]).map((m, i) => {
    const member = m as Record<string, unknown>;
    if (!member.id) throw new Error(`members[${i}] missing required field: id`);
    const agendaRaw = (member.agenda ?? {}) as Record<string, unknown>;
    const goals: CastGoal[] = Array.isArray(agendaRaw.goals)
      ? (agendaRaw.goals as unknown[]).map((g, j) => {
          const goal = g as Record<string, unknown>;
          return {
            id: String(goal.id ?? `goal_${i}_${j}`),
            description: String(goal.description ?? ''),
            arcStage: typeof goal.arcStage === 'number' ? goal.arcStage : j + 1,
          };
        })
      : [];
    const weeklyPattern: CastAgenda['weeklyPattern'] = {};
    const wpRaw = (agendaRaw.weeklyPattern ?? {}) as Record<string, unknown>;
    for (const [daypart, entries] of Object.entries(wpRaw)) {
      weeklyPattern[daypart] = Array.isArray(entries)
        ? (entries as unknown[]).map(en => {
            const entry = en as Record<string, unknown>;
            return { tag: String(entry.tag ?? ''), weight: Number(entry.weight ?? 1) || 1 };
          })
        : [];
    }
    const locationTags: Record<string, string> = {};
    const tagsRaw = (agendaRaw.locationTags ?? {}) as Record<string, unknown>;
    for (const [tag, desc] of Object.entries(tagsRaw)) locationTags[tag] = String(desc ?? '');
    return {
      id: String(member.id),
      isLI: Boolean(member.isLI),
      agenda: {
        goals,
        weeklyPattern,
        locationTags,
        ...(agendaRaw.idealRelationship ? { idealRelationship: String(agendaRaw.idealRelationship) } : {}),
        ...(agendaRaw.worstRelationship ? { worstRelationship: String(agendaRaw.worstRelationship) } : {}),
      },
    };
  });

  return { members };
}
