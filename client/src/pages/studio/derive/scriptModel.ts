import { assignBeatSlots } from '@/narrative/beatSchedule';
import { establishableFlags } from '@/narrative/calendarSliceModel';
import { actOfSlot, slotLabel } from '@/narrative/calendarTypes';
import { formatEffect, formatGuard } from '@/narrative/events';
import { guardFlags } from '@/narrative/validateSpine';

import { failedIds } from './hierarchyModel';

import type { Calendar, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit, DialogueUnitNode } from '@/narrative/dialogueUnit';
import type { AnchorBeat, Brief, DialogueVariantBracket, SegmentIssue, WorldModel } from '@/narrative/types';

import type { Selection } from '../studioStore';

/**
 * «Сценарий»: та же история, прочитанная подряд — слот за слотом, бит за
 * битом. Диалоговые юниты разворачиваются обходом от entryNodeId: выборы
 * остаются видимыми как развилки внутри сцены, а не сворачиваются в текст.
 */

export type ScriptLine =
  | { kind: 'narration'; text: string }
  | { kind: 'speech'; speaker: string; emotion?: string; text: string }
  | { kind: 'choice'; text: string; note: string }
  | { kind: 'node'; text: string };

export type ScriptBlockState = 'done' | 'empty' | 'failed' | 'locked';

export type ScriptBlock = {
  key: string;
  kind: 'beat' | 'unit';
  title: string;
  /** «кафе · Кира, Юки» — место и участники. */
  meta: string;
  state: ScriptBlockState;
  guardText: string;
  effectText: string;
  lines: ScriptLine[];
  selection: Selection;
};

export type ScriptSlotGroup = {
  slot: number;
  label: string;
  act: number;
  dayStart: boolean;
  blocks: ScriptBlock[];
};

export type ScriptModel = {
  groups: ScriptSlotGroup[];
  /** Ступень отношений, в которой читается проза встреч. */
  bracket: DialogueVariantBracket;
  /** Блоков всего / из них с прозой — для шапки вкладки. */
  total: number;
  withProse: number;
};

export type ScriptInputs = {
  brief: Brief;
  calendar: Calendar;
  spine: SpinePlan;
  worldModel: WorldModel | null;
  eventUnits: Record<string, EventUnit>;
  unitProse: Record<string, DialogueUnit[]>;
  spineBeatProse: Record<string, AnchorBeat>;
  bracket?: DialogueVariantBracket;
  branchAssignment?: Record<string, string>;
  issues?: SegmentIssue[];
};

export function deriveScript(inputs: ScriptInputs): ScriptModel {
  const {
    brief,
    calendar,
    spine,
    worldModel,
    eventUnits,
    unitProse,
    spineBeatProse,
    bracket = 'neutral',
    branchAssignment = {},
    issues = [],
  } = inputs;

  const failed = failedIds(issues);
  const reachable = establishableFlags(spine, branchAssignment);
  const beatSlots = assignBeatSlots(spine, calendar);

  const locName = (id: string | undefined): string => {
    if (!id) return '—';
    return (worldModel?.locations ?? []).find(l => l.id === id)?.name || id;
  };
  const charName = (id: string): string =>
    brief.loveInterests.find(li => li.id === id)?.name || (id === 'protagonist' ? 'Я' : id);

  const groups = new Map<number, ScriptSlotGroup>();
  const groupOf = (slot: number): ScriptSlotGroup => {
    const existing = groups.get(slot);
    if (existing) return existing;
    const parts = calendar.dayparts.length || 1;
    const created: ScriptSlotGroup = {
      slot,
      label: slotLabel(slot, calendar),
      act: actOfSlot(slot, calendar),
      dayStart: slot % parts === 0,
      blocks: [],
    };
    groups.set(slot, created);
    return created;
  };

  // ── Биты хребта ──────────────────────────────────────────────────────────
  for (const beat of spine.beats) {
    const slot = beatSlots[beat.id];
    if (slot == null || slot < 0 || slot >= calendar.slotCount) continue;
    const prose = spineBeatProse[beat.id];
    const dimmed = !guardFlags(beat.guard).every(flag => reachable.has(flag));

    const lines: ScriptLine[] = [];
    if (prose?.beatText) lines.push({ kind: 'narration', text: prose.beatText });
    for (const transition of prose?.transitions ?? []) {
      lines.push({ kind: 'choice', text: transition.label, note: `→ ${transition.toAnchorId}` });
    }

    groupOf(slot).blocks.push({
      key: `beat:${beat.id}`,
      kind: 'beat',
      title: beat.summary || beat.id,
      meta: [locName(beat.locationId), beat.participants.map(charName).join(', ')].filter(Boolean).join(' · '),
      state: blockState({ failed: failed.has(beat.id), dimmed, hasProse: Boolean(prose) }),
      guardText: formatGuard(beat.guard),
      effectText: beat.establishes.map(f => `+${f}`).join(' · ') || '—',
      lines,
      selection: { kind: 'beat', id: beat.id },
    });
  }

  // ── Встречи: одна запись на юнит, в первом слоте своего окна ─────────────
  for (const unit of Object.values(eventUnits)) {
    const window = unit.at.slot;
    if (!window) continue;
    const slot = Math.max(0, Math.min(calendar.slotCount - 1, window.fromSlot));
    const dialogue = (unitProse[unit.id] ?? []).find(d => d.bracket === bracket);
    const dimmed = !guardFlags(unit.guard).every(flag => reachable.has(flag));

    groupOf(slot).blocks.push({
      key: `unit:${unit.id}:${bracket}`,
      kind: 'unit',
      title: unit.goal || unit.id,
      meta: [
        locName(unit.at.locationId),
        unit.participants.map(charName).join(', '),
        window.fromSlot === window.toSlot
          ? null
          : `окно ${slotLabel(window.fromSlot, calendar)} — ${slotLabel(window.toSlot, calendar)}`,
      ]
        .filter(Boolean)
        .join(' · '),
      state: blockState({
        failed: failed.has(unit.id),
        dimmed,
        hasProse: Boolean(dialogue),
      }),
      guardText: formatGuard(unit.guard),
      effectText: unit.effects.map(e => formatEffect(e)).join(' · ') || '—',
      lines: dialogue ? unitLines(dialogue, charName) : [],
      selection: { kind: 'unit', unitId: unit.id, bracket },
    });
  }

  const ordered = [...groups.values()].sort((a, b) => a.slot - b.slot);
  for (const group of ordered) {
    // Хребет всегда впереди болтовни — так же, как его ставит режиссёр.
    group.blocks.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'beat' ? -1 : 1));
  }

  const all = ordered.flatMap(g => g.blocks);
  return {
    groups: ordered,
    bracket,
    total: all.length,
    withProse: all.filter(b => b.lines.length > 0).length,
  };
}

function blockState(flags: { failed: boolean; dimmed: boolean; hasProse: boolean }): ScriptBlockState {
  if (flags.failed) return 'failed';
  if (flags.dimmed) return 'locked';
  return flags.hasProse ? 'done' : 'empty';
}

/**
 * Обход юнита от входного узла в ширину: каждый узел печатается один раз,
 * выборы — строками-развилками с указанием, куда ведут. Циклы обрываются
 * посещёнными узлами, поэтому обход конечен на любом графе.
 */
function unitLines(unit: DialogueUnit, charName: (id: string) => string): ScriptLine[] {
  const byId = new Map(unit.nodes.map(n => [n.id, n]));
  const lines: ScriptLine[] = [];
  const seen = new Set<string>();
  const queue: string[] = [unit.entryNodeId];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;

    lines.push({ kind: 'node', text: nodeLabel(node, id === unit.entryNodeId) });
    if (node.narration) lines.push({ kind: 'narration', text: node.narration });
    for (const line of node.dialogue) {
      lines.push({
        kind: 'speech',
        speaker: charName(line.speaker),
        ...(line.emotion ? { emotion: line.emotion } : null),
        text: line.line,
      });
    }
    for (const choice of node.choices) {
      const deltas = Object.entries(choice.effects.stateDeltas)
        .map(([path, value]) => `${path} ${value > 0 ? '+' : ''}${value}`)
        .join(' · ');
      const flags = [...choice.effects.flagSet.map(f => `+${f}`), ...choice.effects.flagClear.map(f => `−${f}`)].join(
        ' · ',
      );
      lines.push({
        kind: 'choice',
        text: choice.text,
        note: [choice.kind, deltas, flags, `→ ${choice.next}`].filter(Boolean).join(' · '),
      });
      queue.push(choice.next);
    }
  }

  if (unit.farewell) {
    lines.push({ kind: 'node', text: 'прощание' });
    if (unit.farewell.narration) lines.push({ kind: 'narration', text: unit.farewell.narration });
    for (const line of unit.farewell.dialogue) {
      lines.push({
        kind: 'speech',
        speaker: charName(line.speaker),
        ...(line.emotion ? { emotion: line.emotion } : null),
        text: line.line,
      });
    }
  }

  return lines;
}

const nodeLabel = (node: DialogueUnitNode, entry: boolean): string => {
  if (entry) return `${node.id} · вход`;
  return node.closing || node.choices.length === 0 ? `${node.id} · выход` : node.id;
};
