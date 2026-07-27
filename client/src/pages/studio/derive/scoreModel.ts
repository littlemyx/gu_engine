import { assignBeatSlots } from '@/narrative/beatSchedule';
import { establishableFlags } from '@/narrative/calendarSliceModel';
import { actOfSlot, slotLabel } from '@/narrative/calendarTypes';
import { deriveMontageCharacters, truncate } from '@/narrative/sliceModel';
import { guardFlags } from '@/narrative/validateSpine';

import { failedIds } from './hierarchyModel';

import type { Calendar, CharacterSchedule, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit } from '@/narrative/dialogueUnit';
import type { AnchorBeat, Brief, SegmentIssue, WorldModel } from '@/narrative/types';
import type { SlotCellState } from '@/ui/SlotCell';

/**
 * «Партитура»: строка — персонаж, колонка — слот календаря. В клетке стоит
 * короткое имя локации, где персонаж в этот слот находится; заливка и рамка
 * кодируют, что там происходит (бит хребта, встреча, ничего). Подробности —
 * в инспекторе слота, как и везде в шелле.
 */

export type ScoreCellEvent = {
  id: string;
  kind: 'beat' | 'unit';
  title: string;
  hasProse: boolean;
  /** Погашено селектором веток: guard требует флаг чужой ветки. */
  dimmed: boolean;
  failed: boolean;
};

export type ScoreCell = {
  charId: string;
  slot: number;
  locationId: string | null;
  /** Текст ячейки: короткое имя локации + «+N» при нескольких событиях. */
  text: string;
  state: SlotCellState;
  tip: string;
  events: ScoreCellEvent[];
};

export type ScoreRow = {
  charId: string;
  name: string;
  color: string;
  cells: ScoreCell[];
  /** Сколько клеток строки содержат события — метка в шапке строки. */
  eventCount: number;
};

export type ScoreColumn = {
  slot: number;
  /** «день 3 · вечер» — подсказка. */
  label: string;
  /** Короткая подпись колонки: часть дня. */
  short: string;
  day: number;
  act: number;
  dayStart: boolean;
};

/** Покрытие слота: есть ли что играть и написано ли оно. */
export type ScoreCoverage = {
  slot: number;
  glyph: '●' | '○' | '⚠';
  tip: string;
};

export type ScoreModel = {
  columns: ScoreColumn[];
  /** Верхняя строка сетки: биты хребта по слотам. */
  spine: ScoreCell[];
  rows: ScoreRow[];
  coverage: ScoreCoverage[];
  /** Расшифровка двухбуквенных кодов локаций под сеткой. */
  locationCodes: Array<{ code: string; name: string }>;
  acts: Array<{ act: number; fromSlot: number; toSlot: number }>;
};

export type ScoreInputs = {
  brief: Brief;
  calendar: Calendar;
  spine: SpinePlan;
  schedule: CharacterSchedule;
  worldModel: WorldModel | null;
  eventUnits: Record<string, EventUnit>;
  unitProse: Record<string, DialogueUnit[]>;
  spineBeatProse: Record<string, AnchorBeat>;
  branchAssignment?: Record<string, string>;
  issues?: SegmentIssue[];
};

/** Приоритет состояния клетки: чем выше, тем важнее показать. */
const STATE_RANK: Record<SlotCellState, number> = {
  offscreen: 0,
  empty: 1,
  loc: 2,
  locked: 3,
  open: 4,
  done: 5,
  failed: 6,
};

export function deriveScore(inputs: ScoreInputs): ScoreModel {
  const {
    brief,
    calendar,
    spine,
    schedule,
    worldModel,
    eventUnits,
    unitProse,
    spineBeatProse,
    branchAssignment = {},
    issues = [],
  } = inputs;

  const characters = deriveMontageCharacters(brief);
  const failed = failedIds(issues);
  const reachable = establishableFlags(spine, branchAssignment);
  const beatSlots = assignBeatSlots(spine, calendar);

  const locById = new Map((worldModel?.locations ?? []).map(l => [l.id, l]));
  const locName = (id: string): string => locById.get(id)?.name || id;
  const codeOf = buildLocationCodes([...locById.keys()].sort(), locName);

  // ── Колонки календаря ────────────────────────────────────────────────────
  const parts = calendar.dayparts.length || 1;
  const columns: ScoreColumn[] = [];
  for (let slot = 0; slot < calendar.slotCount; slot++) {
    columns.push({
      slot,
      label: slotLabel(slot, calendar),
      short: calendar.dayparts[slot % parts] ?? String(slot),
      day: Math.floor(slot / parts) + 1,
      act: actOfSlot(slot, calendar),
      dayStart: slot % parts === 0,
    });
  }

  // ── События по (слот, локация) ───────────────────────────────────────────
  // Ключ клетки строится по месту, а не по персонажу: одно и то же событие
  // видно всем участникам, оказавшимся там в этот слот.
  type Placed = ScoreCellEvent & { participants: Set<string> };
  const byCell = new Map<string, Placed[]>();
  const cellKey = (slot: number, locationId: string): string => `${slot}|${locationId}`;
  /** Служебное поле participants наружу не выходит — оно нужно только раскладке. */
  const strip = (e: Placed): ScoreCellEvent => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    hasProse: e.hasProse,
    dimmed: e.dimmed,
    failed: e.failed,
  });
  const push = (slot: number, locationId: string, event: Placed): void => {
    const key = cellKey(slot, locationId);
    byCell.set(key, [...(byCell.get(key) ?? []), event]);
  };

  for (const beat of spine.beats) {
    const slot = beatSlots[beat.id];
    if (slot == null || slot < 0 || slot >= calendar.slotCount) continue;
    push(slot, beat.locationId, {
      id: beat.id,
      kind: 'beat',
      title: truncate(beat.summary || beat.id, 60),
      hasProse: Boolean(spineBeatProse[beat.id]),
      dimmed: !guardFlags(beat.guard).every(flag => reachable.has(flag)),
      failed: failed.has(beat.id),
      participants: new Set(beat.participants),
    });
  }

  for (const unit of Object.values(eventUnits)) {
    const window = unit.at.slot;
    const locationId = unit.at.locationId;
    if (!window || !locationId) continue;
    const from = Math.max(0, window.fromSlot);
    const to = Math.min(calendar.slotCount - 1, window.toSlot);
    const brackets = unitProse[unit.id]?.length ?? 0;
    for (let slot = from; slot <= to; slot++) {
      push(slot, locationId, {
        id: unit.id,
        kind: 'unit',
        title: truncate(unit.goal || unit.id, 60),
        hasProse: brackets > 0,
        dimmed: !guardFlags(unit.guard).every(flag => reachable.has(flag)),
        failed: failed.has(unit.id),
        participants: new Set(unit.participants),
      });
    }
  }

  // ── Строки-персонажи ─────────────────────────────────────────────────────
  const rows: ScoreRow[] = characters.map(character => {
    let eventCount = 0;
    const cells: ScoreCell[] = columns.map(({ slot }) => {
      const locationId = schedule[character.id]?.[slot] ?? null;
      const events: ScoreCellEvent[] = locationId
        ? (byCell.get(cellKey(slot, locationId)) ?? [])
            .filter(e => e.participants.size === 0 || e.participants.has(character.id))
            .map(strip)
        : [];
      if (events.length > 0) eventCount += 1;

      const state = cellState(events, locationId);
      const code = locationId ? codeOf(locationId) : '—';
      // «КФ+2» — счётчик появляется только при нескольких событиях: одиночное
      // читается по заливке клетки, а лишняя цифра съедала бы код локации.
      const text = events.length >= 2 ? `${code}+${events.length}` : code;

      return {
        charId: character.id,
        slot,
        locationId,
        text,
        state,
        tip: tipFor(locationId ? locName(locationId) : null, events),
        events,
      };
    });

    return {
      charId: character.id,
      name: character.name,
      color: character.color,
      cells,
      eventCount,
    };
  });

  // ── Строка хребта: биты по слотам ────────────────────────────────────────
  const orderOfBeat = new Map(spine.beats.map((b, index) => [b.id, index + 1]));
  const beatsBySlot = new Map<number, ScoreCellEvent[]>();
  for (const [key, placed] of byCell) {
    const slot = Number(key.split('|')[0]);
    for (const placedEvent of placed) {
      if (placedEvent.kind !== 'beat') continue;
      const event = strip(placedEvent);
      const list = beatsBySlot.get(slot) ?? [];
      // Одно и то же событие лежит в клетке места один раз, но обход идёт
      // по всем локациям слота — дубли по id отсекаем здесь.
      if (!list.some(e => e.id === event.id)) list.push(event);
      beatsBySlot.set(slot, list);
    }
  }

  const spineCells: ScoreCell[] = columns.map(({ slot }) => {
    const events = beatsBySlot.get(slot) ?? [];
    const first = events[0];
    const label = first ? `Б${orderOfBeat.get(first.id) ?? '?'}` : '·';
    return {
      charId: '',
      slot,
      locationId: null,
      text: events.length >= 2 ? `${label}+${events.length}` : label,
      state: events.length === 0 ? 'empty' : cellState(events, 'spine'),
      tip: events.length === 0 ? 'битов нет' : events.map(e => `◈ ${e.title}`).join('\n'),
      events,
    };
  });

  // ── Покрытие: есть ли в слоте что играть и написано ли оно ───────────────
  const coverage: ScoreCoverage[] = columns.map(({ slot }) => {
    const all = rows.flatMap(row => row.cells[slot]?.events ?? []);
    const beats = spineCells[slot]?.events ?? [];
    const total = [...beats, ...all];
    if (total.length === 0) return { slot, glyph: '⚠', tip: 'в слоте нечего играть' };
    const written = total.filter(e => e.hasProse).length;
    return written === total.length
      ? { slot, glyph: '●', tip: `${total.length} сцен · проза готова` }
      : { slot, glyph: '○', tip: `${written}/${total.length} сцен с прозой` };
  });

  const acts: ScoreModel['acts'] = [];
  for (const column of columns) {
    const last = acts[acts.length - 1];
    if (last && last.act === column.act) last.toSlot = column.slot;
    else acts.push({ act: column.act, fromSlot: column.slot, toSlot: column.slot });
  }

  // В расшифровку идут только те локации, что реально стоят в сетке.
  const usedLocIds = new Set<string>();
  for (const row of rows) for (const cell of row.cells) if (cell.locationId) usedLocIds.add(cell.locationId);
  const locationCodes = [...usedLocIds].sort().map(id => ({ code: codeOf(id), name: locName(id) }));

  return { columns, spine: spineCells, rows, coverage, locationCodes, acts };
}

/**
 * Двухбуквенные коды локаций для клеток 33px: «кафе "Прибой"» → КФ. Коды
 * детерминированы (обход по отсортированным id) и уникальны — иначе легенда
 * под сеткой врала бы.
 */
function buildLocationCodes(ids: string[], nameOf: (id: string) => string): (id: string) => string {
  const codes = new Map<string, string>();
  const used = new Set<string>();
  for (const id of ids) {
    const name = nameOf(id);
    const words = name.split(/[\s_-]+/).filter(Boolean);
    const base = (words.length >= 2 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2)).toUpperCase();
    let code = base;
    for (let i = 2; used.has(code); i += 1) code = `${base[0]}${i}`;
    used.add(code);
    codes.set(id, code);
  }
  return (id: string) => codes.get(id) ?? id.slice(0, 2).toUpperCase();
}

/**
 * Состояние клетки — максимум по её событиям: одна ошибка красит клетку в
 * сбой, даже если рядом стоит готовая сцена. `open` = событие есть, прозы нет.
 */
function cellState(events: ScoreCellEvent[], locationId: string | null): SlotCellState {
  if (locationId == null) return 'offscreen';
  if (events.length === 0) return 'loc';

  let state: SlotCellState = 'loc';
  for (const event of events) {
    const own: SlotCellState = event.failed ? 'failed' : event.dimmed ? 'locked' : event.hasProse ? 'done' : 'open';
    if (STATE_RANK[own] > STATE_RANK[state]) state = own;
  }
  return state;
}

function tipFor(locationName: string | null, events: ScoreCellEvent[]): string {
  if (locationName == null) return 'за кадром';
  if (events.length === 0) return locationName;
  return `${locationName}\n${events.map(e => `${e.kind === 'beat' ? '◈' : '›'} ${e.title}`).join('\n')}`;
}
