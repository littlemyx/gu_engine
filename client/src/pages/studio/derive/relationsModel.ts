import { assignBeatSlots } from '@/narrative/beatSchedule';
import { deriveMontageCharacters } from '@/narrative/sliceModel';
import { BRACKET_OFFSET } from 'gu-engine-story-core';

import type { Calendar, CharacterSchedule, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit } from '@/narrative/dialogueUnit';
import type { Brief, DialogueVariantBracket } from '@/narrative/types';

/**
 * «Отношения · присутствие и покрытие» (макет 7e): недельная сетка присутствия
 * по слотам и покрытие брекетов warm/neutral/cold диалоговыми юнитами.
 *
 * Зачем: селектору в каждом брекете нужно что играть. Пустой брекет — это не
 * «мало контента», а недостижимая ветка тона: при affection за порогом
 * a₀ ± BRACKET_OFFSET движку нечего показать, и разговор не состоится.
 */

/** Слой клетки присутствия: якорный бит > встреча > в локации > за кадром. */
export type RelationsCellLayer = 'offscreen' | 'present' | 'meeting' | 'anchor';

export type RelationsRow = {
  liId: string;
  name: string;
  color: string;
  cells: RelationsCellLayer[];
};

export type BracketLevel = 'ok' | 'warn' | 'bad';

export type BracketCell = { count: number; level: BracketLevel };

export type RelationsCoverageRow = {
  liId: string;
  name: string;
  warm: BracketCell;
  neutral: BracketCell;
  cold: BracketCell;
};

export type RelationsModel = {
  /** Подписи дней («пн»… либо «день N») по колонкам сетки. */
  days: string[];
  partsPerDay: number;
  slotCount: number;
  /** Подпись легенды: «21 слот = 7 дней × 3 фазы». */
  slotNote: string;
  rows: RelationsRow[];
  coverage: RelationsCoverageRow[];
  /** Недостижимые брекеты: строки-объяснения + liId для CTA догенерации. */
  problems: Array<{ liId: string; name: string; bracket: DialogueVariantBracket; message: string }>;
};

export type RelationsInputs = {
  brief: Brief;
  calendar: Calendar;
  spine: SpinePlan;
  schedule: CharacterSchedule;
  eventUnits: Record<string, EventUnit>;
  unitProse: Record<string, DialogueUnit[]>;
};

/** Дни недели для «канонического» календаря на 7 дней; иначе «д1, д2…». */
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const BRACKET_UI: Record<DialogueVariantBracket, 'warm' | 'neutral' | 'cold'> = {
  positive: 'warm',
  neutral: 'neutral',
  negative: 'cold',
};

const levelOf = (count: number): BracketLevel => (count === 0 ? 'bad' : count === 1 ? 'warn' : 'ok');

export function deriveRelations(inputs: RelationsInputs): RelationsModel {
  const { brief, calendar, spine, schedule, eventUnits, unitProse } = inputs;

  const characters = deriveMontageCharacters(brief);
  const parts = calendar.dayparts.length || 1;
  const dayCount = Math.ceil(calendar.slotCount / parts);
  const days = Array.from({ length: dayCount }, (_, i) => (dayCount === 7 ? WEEKDAYS[i] : `д${i + 1}`));

  const beatSlots = assignBeatSlots(spine, calendar);
  const anchorSlotsByChar = new Map<string, Set<number>>();
  for (const beat of spine.beats) {
    const slot = beatSlots[beat.id];
    if (slot == null) continue;
    for (const charId of beat.participants) {
      const set = anchorSlotsByChar.get(charId) ?? new Set<number>();
      set.add(slot);
      anchorSlotsByChar.set(charId, set);
    }
  }

  // ── Сетка присутствия ────────────────────────────────────────────────────
  const rows: RelationsRow[] = characters.map(character => {
    const anchors = anchorSlotsByChar.get(character.id) ?? new Set<number>();
    const slots = schedule[character.id] ?? [];
    const cells: RelationsCellLayer[] = [];
    for (let slot = 0; slot < calendar.slotCount; slot++) {
      const locationId = slots[slot] ?? null;
      if (anchors.has(slot)) {
        cells.push('anchor');
        continue;
      }
      if (locationId == null) {
        cells.push('offscreen');
        continue;
      }
      cells.push('present');
    }
    return { liId: character.id, name: character.name, color: character.color, cells };
  });

  // Встречи: окно юнита в локации, где персонаж стоит по расписанию.
  for (const unit of Object.values(eventUnits)) {
    const window = unit.at.slot;
    const locationId = unit.at.locationId;
    if (!window || !locationId) continue;
    for (const row of rows) {
      if (unit.participants.length > 0 && !unit.participants.includes(row.liId)) continue;
      const slots = schedule[row.liId] ?? [];
      const from = Math.max(0, window.fromSlot);
      const to = Math.min(calendar.slotCount - 1, window.toSlot);
      for (let slot = from; slot <= to; slot++) {
        if (slots[slot] !== locationId) continue;
        if (row.cells[slot] === 'present') row.cells[slot] = 'meeting';
      }
    }
  }

  // ── Покрытие брекетов ────────────────────────────────────────────────────
  const countsByChar = new Map<string, Record<'warm' | 'neutral' | 'cold', number>>();
  for (const character of characters) countsByChar.set(character.id, { warm: 0, neutral: 0, cold: 0 });
  for (const unit of Object.values(eventUnits)) {
    const owner = unit.participants[0];
    const counts = owner ? countsByChar.get(owner) : undefined;
    if (!counts) continue;
    const variants = unitProse[unit.id] ?? [];
    const seen = new Set<DialogueVariantBracket>();
    for (const variant of variants) {
      if (seen.has(variant.bracket)) continue;
      seen.add(variant.bracket);
      counts[BRACKET_UI[variant.bracket]] += 1;
    }
  }

  const coverage: RelationsCoverageRow[] = characters.map(character => {
    const counts = countsByChar.get(character.id) ?? { warm: 0, neutral: 0, cold: 0 };
    return {
      liId: character.id,
      name: character.name,
      warm: { count: counts.warm, level: levelOf(counts.warm) },
      neutral: { count: counts.neutral, level: levelOf(counts.neutral) },
      cold: { count: counts.cold, level: levelOf(counts.cold) },
    };
  });

  const problems: RelationsModel['problems'] = [];
  for (const row of coverage) {
    const sides: Array<{ ui: 'warm' | 'cold'; bracket: DialogueVariantBracket; cell: BracketCell; cond: string }> = [
      { ui: 'warm', bracket: 'positive', cell: row.warm, cond: `affection ≥ a₀ + ${BRACKET_OFFSET}` },
      { ui: 'cold', bracket: 'negative', cell: row.cold, cond: `affection ≤ a₀ − ${BRACKET_OFFSET}` },
    ];
    for (const side of sides) {
      if (side.cell.level !== 'bad') continue;
      problems.push({
        liId: row.liId,
        name: row.name,
        bracket: side.bracket,
        message: `${side.ui === 'warm' ? 'тёплый' : 'холодный'} брекет ${
          row.name
        } недостижим в диалоге — селектору нечего играть при ${side.cond}`,
      });
    }
  }

  return {
    days,
    partsPerDay: parts,
    slotCount: calendar.slotCount,
    slotNote: `${calendar.slotCount} слотов = ${dayCount} дней × ${parts} фазы`,
    rows,
    coverage,
    problems,
  };
}
