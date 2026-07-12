import type { AnchorBeat, Brief, WorldModel } from './types';
import type { Calendar, CharacterSchedule, SpineBeat, SpineBeatKind, SpinePlan } from './calendarTypes';
import { actOfSlot, actSlotWindow, slotLabel } from './calendarTypes';
import { assignBeatSlots } from './beatSchedule';
import { formatGuard } from './events';
import type { EventDef } from './events';
import {
  deriveMontageCharacters,
  locationAmbientLabel,
  shorten,
  truncate,
  type MontageCharacter,
  type MontageLocation,
  type SliceEventView,
} from './sliceModel';

/**
 * Календарная монтажная модель: z = индекс слота (день × часть дня), срез
 * содержит НЕСКОЛЬКО локаций-боксов — у каждой свои присутствующие персонажи
 * (из CharacterSchedule) и события (биты хребта, назначенные assignBeatSlots).
 *
 * Родственник deriveMontageModel (sliceModel.ts): те же MontageCharacter /
 * SliceEventView / MontageLocation, чтобы MontageBoard рендерил оба варианта
 * одним визуальным языком. План: docs/plans/calendar-branching.md §Монтажка.
 */

export type CalendarSliceLocation = {
  locationId: string;
  locationName: string;
  ambientLabel: string | null;
  presentCharIds: string[];
  events: SliceEventView[];
};

export type CalendarSlice = {
  slot: number;
  /** «день 3 · вечер». */
  label: string;
  act: number;
  /** Первый слот дня — акцент кадра на доске. */
  dayStart: boolean;
  locations: CalendarSliceLocation[];
};

export type CalendarMove = {
  charId: string;
  fromSlot: number;
  toSlot: number;
  fromLoc: string;
  toLoc: string;
};

export type CalendarMontageModel = {
  slices: CalendarSlice[];
  characters: MontageCharacter[];
  moves: CalendarMove[];
  /** charId → интервалы слотов на сцене (для дорожек таймлайна). */
  presence: Record<string, Array<[number, number]>>;
  locations: MontageLocation[];
  adjacency: Array<[string, string]>;
  acts: Array<{ act: number; fromZ: number; toZ: number }>;
};

export type CalendarMontageInputs = {
  brief: Brief;
  calendar: Calendar;
  spine: SpinePlan;
  schedule: CharacterSchedule;
  worldModel: WorldModel | null;
  spineBeatProse: Record<string, AnchorBeat>;
};

const BEAT_KIND_ICON: Record<SpineBeatKind, string> = {
  beat: '⚑',
  branchPoint: '⚑',
  actGate: '▸',
  finale: '◆',
};

export function deriveCalendarMontage(inputs: CalendarMontageInputs): CalendarMontageModel {
  const { brief, calendar, spine, schedule, worldModel, spineBeatProse } = inputs;

  const characters = deriveMontageCharacters(brief);
  const charIds = new Set(characters.map(c => c.id));
  const locById = new Map((worldModel?.locations ?? []).map(l => [l.id, l]));
  const locName = (id: string): string => locById.get(id)?.name || id;

  // ── Биты хребта по назначенным слотам ────────────────────────────────────
  const beatSlots = assignBeatSlots(spine, calendar);
  const beatsBySlot = new Map<number, SpineBeat[]>();
  for (const beat of spine.beats) {
    const s = beatSlots[beat.id];
    if (s == null || s < 0 || s >= calendar.slotCount) continue;
    const list = beatsBySlot.get(s) ?? [];
    list.push(beat);
    beatsBySlot.set(s, list);
  }

  const beatEventView = (beat: SpineBeat, slot: number): SliceEventView => {
    // Плейсхолдеры ролей ("$closestLI") в участники события не попадают.
    const participants = beat.participants.filter(p => charIds.has(p));
    const prose = spineBeatProse[beat.id];
    const def: EventDef = {
      id: beat.id,
      kind: 'state_change',
      at: {
        slot: { fromSlot: beat.window.fromSlot, toSlot: beat.window.toSlot },
        locationId: beat.locationId,
      },
      participants,
      guard: beat.guard,
      effects: beat.establishes.map(f => ({ setFlag: f })),
      scene: prose ? { kind: 'beat', anchorId: beat.id } : null,
      priority: 50,
    };
    return {
      def,
      n: '',
      z: slot,
      charId: participants[0] ?? null,
      title: truncate(beat.summary || beat.id, 40),
      condText: formatGuard(beat.guard),
      effectText: beat.establishes.length > 0 ? beat.establishes.map(f => `+${f}`).join(' · ') : '—',
      hasScene: Boolean(prose),
      sceneStatus: prose ? { done: 1, total: 1 } : null,
      kindIcon: BEAT_KIND_ICON[beat.kind],
    };
  };

  // ── Срезы: один на слот, локации-боксы по расписанию и битам ─────────────
  const slices: CalendarSlice[] = [];
  for (let slot = 0; slot < calendar.slotCount; slot++) {
    const charsByLoc = new Map<string, string[]>();
    for (const c of characters) {
      const loc = schedule[c.id]?.[slot] ?? null;
      if (!loc) continue;
      charsByLoc.set(loc, [...(charsByLoc.get(loc) ?? []), c.id]);
    }
    const eventsByLoc = new Map<string, SliceEventView[]>();
    for (const beat of beatsBySlot.get(slot) ?? []) {
      eventsByLoc.set(beat.locationId, [...(eventsByLoc.get(beat.locationId) ?? []), beatEventView(beat, slot)]);
    }
    const locIds = new Set([...eventsByLoc.keys(), ...charsByLoc.keys()]);
    const locations: CalendarSliceLocation[] = [...locIds]
      .map(id => ({
        locationId: id,
        locationName: locName(id),
        ambientLabel: locationAmbientLabel(locById.get(id)),
        presentCharIds: charsByLoc.get(id) ?? [],
        events: eventsByLoc.get(id) ?? [],
      }))
      // Локации с событиями вперёд, затем по людности, затем стабильно по id.
      .sort(
        (a, b) =>
          b.events.length - a.events.length ||
          b.presentCharIds.length - a.presentCharIds.length ||
          (a.locationId < b.locationId ? -1 : 1),
      );
    slices.push({
      slot,
      label: slotLabel(slot, calendar),
      act: actOfSlot(slot, calendar),
      dayStart: slot % calendar.dayparts.length === 0,
      locations,
    });
  }

  // ── Сквозная нумерация e1…eN: слот → порядок локаций ─────────────────────
  let counter = 0;
  for (const slice of slices) {
    for (const loc of slice.locations) {
      for (const ev of loc.events) {
        counter++;
        ev.n = `e${counter}`;
      }
    }
  }

  // ── Перемещения по расписанию между соседними слотами ────────────────────
  const moves: CalendarMove[] = [];
  for (const c of characters) {
    const track = schedule[c.id] ?? [];
    for (let s = 1; s < calendar.slotCount; s++) {
      const from = track[s - 1];
      const to = track[s];
      if (from && to && from !== to) {
        moves.push({ charId: c.id, fromSlot: s - 1, toSlot: s, fromLoc: from, toLoc: to });
      }
    }
  }

  // ── Дорожки присутствия ──────────────────────────────────────────────────
  const presence: Record<string, Array<[number, number]>> = {};
  for (const c of characters) {
    const ranges: Array<[number, number]> = [];
    let start: number | null = null;
    for (let s = 0; s < calendar.slotCount; s++) {
      const here = (schedule[c.id]?.[s] ?? null) != null;
      if (here && start === null) start = s;
      if (!here && start !== null) {
        ranges.push([start, s - 1]);
        start = null;
      }
    }
    if (start !== null) ranges.push([start, calendar.slotCount - 1]);
    presence[c.id] = ranges;
  }

  // ── Локации и допустимые пути для мини-карты ─────────────────────────────
  const usedLocIds = new Set<string>();
  for (const s of slices) for (const l of s.locations) usedLocIds.add(l.locationId);
  for (const m of moves) {
    usedLocIds.add(m.fromLoc);
    usedLocIds.add(m.toLoc);
  }
  const locations: MontageLocation[] = worldModel
    ? worldModel.locations.map(l => ({ id: l.id, name: l.name || l.id, shortName: shorten(l.name || l.id) }))
    : [...usedLocIds].map(id => ({ id, name: id, shortName: shorten(id) }));

  const adjacency: Array<[string, string]> = [];
  const seenPairs = new Set<string>();
  const addPair = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (a === b || seenPairs.has(key)) return;
    seenPairs.add(key);
    adjacency.push(a < b ? [a, b] : [b, a]);
  };
  if (worldModel) {
    for (const loc of worldModel.locations) {
      for (const adj of loc.adjacent) addPair(loc.id, adj.locationId);
    }
  } else {
    for (const m of moves) addPair(m.fromLoc, m.toLoc);
  }

  // ── Полоса актов из границ календаря ─────────────────────────────────────
  const acts: Array<{ act: number; fromZ: number; toZ: number }> = [];
  for (let act = 1; act <= calendar.actBoundaries.length; act++) {
    const w = actSlotWindow(act, calendar);
    const fromZ = Math.max(0, w.fromSlot);
    const toZ = Math.min(calendar.slotCount - 1, w.toSlot);
    if (fromZ <= toZ) acts.push({ act, fromZ, toZ });
  }

  return { slices, characters, moves, presence, locations, adjacency, acts };
}
