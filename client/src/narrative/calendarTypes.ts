import type { EndingKind } from './types';
import type { EventDef, Guard, SlotWindow } from './events';

export type { SlotWindow } from './events';

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
      agenda: { goals, weeklyPattern, locationTags },
    };
  });

  return { members };
}
