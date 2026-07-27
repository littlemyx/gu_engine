import { deriveBeatChain } from '@/narrative/beatChain';
import { assignBeatSlots } from '@/narrative/beatSchedule';
import { establishableFlags } from '@/narrative/calendarSliceModel';
import { actOfSlot, slotLabel } from '@/narrative/calendarTypes';
import { truncate } from '@/narrative/sliceModel';
import { guardFlags } from '@/narrative/validateSpine';

import type { BulkCalendarPhase } from '@/narrative/calendarRunState';
import type { Calendar, SpineBeat, SpinePlan } from '@/narrative/calendarTypes';
import type { AnchorBeat, SegmentIssue } from '@/narrative/types';
import type { BeatCardState } from '@/ui/BeatCard';

/** Карточка бита на «Чертеже» вместе с её местом в раскладке. */
export type BlueprintNode = {
  id: string;
  kicker: string;
  title: string;
  state: BeatCardState;
  /** Ветка не выбрана: бит недостижим при текущем branchAssignment. */
  dimmed: boolean;
  /** Слот из assignBeatSlots; null — биту не хватило места. */
  slot: number | null;
  act: number;
  /** Колонка раскладки: порядок по слоту, биты без слота уходят в хвост. */
  column: number;
  /** Дорожка: 0 — основной хребет, дальше ветки. */
  lane: number;
  issues: SegmentIssue[];
  beat: SpineBeat;
};

export type BlueprintEdge = {
  from: string;
  to: string;
  /** Пунктир — переход по исходу развилки. */
  branch: boolean;
  /** Подпись ребра: текст выбора у ветвлений. */
  label?: string;
};

export type BlueprintModel = {
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  columns: number;
  lanes: number;
};

export type BlueprintInputs = {
  spine: SpinePlan;
  calendar: Calendar;
  spineBeatProse: Record<string, AnchorBeat>;
  liIds: string[];
  branchAssignment?: Record<string, string>;
  issues?: SegmentIssue[];
  /** Идёт прогон: биты без прозы на стадии beat_prose показываются как «генерируется». */
  runPhase?: BulkCalendarPhase | null;
};

const BEAT_KIND_GLYPH: Record<SpineBeat['kind'], string> = {
  beat: '⚑',
  branchPoint: '◈',
  actGate: '▸',
  finale: '◆',
};

/** Issues конкретного бита: scope вида `spine/beats/<id>/<аспект>`. */
export function issuesForBeat(issues: SegmentIssue[], beatId: string): SegmentIssue[] {
  const prefix = `beats/${beatId}/`;
  return issues.filter(i => i.scope.includes(prefix));
}

/**
 * Раскладка «Чертежа»: биты хребта по назначенным слотам, дорожки — по веткам,
 * связи — из цепочки предшественников и исходов развилок.
 */
export function deriveBlueprint(inputs: BlueprintInputs): BlueprintModel {
  const { spine, calendar, spineBeatProse, liIds, branchAssignment = {}, issues = [], runPhase = null } = inputs;

  const slots = assignBeatSlots(spine, calendar);
  const reachable = establishableFlags(spine, branchAssignment);
  const chain = deriveBeatChain(spine, calendar, new Set(liIds));

  // Флаг исхода развилки → сама развилка: по нему ребро становится веточным.
  const outcomeOwner = new Map<string, { beatId: string; label: string }>();
  for (const beat of spine.beats) {
    for (const outcome of beat.outcomes ?? []) {
      outcomeOwner.set(outcome.setsFlag, { beatId: beat.id, label: outcome.label });
    }
  }

  // Дорожка бита: основной хребет наверху, каждая ветка — своя полоса.
  const laneOfFlag = new Map<string, number>();
  let nextLane = 1;
  for (const beat of spine.beats) {
    for (const outcome of beat.outcomes ?? []) {
      if (!laneOfFlag.has(outcome.setsFlag)) laneOfFlag.set(outcome.setsFlag, nextLane++);
    }
  }
  const laneOfBeat = (beat: SpineBeat): number => {
    const lanes = guardFlags(beat.guard)
      .map(flag => laneOfFlag.get(flag))
      .filter((lane): lane is number => lane != null);
    return lanes.length === 0 ? 0 : Math.min(...lanes);
  };

  const ordered = [...spine.beats].sort((a, b) => {
    const sa = slots[a.id];
    const sb = slots[b.id];
    if (sa == null && sb == null) return a.id.localeCompare(b.id);
    if (sa == null) return 1;
    if (sb == null) return -1;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });

  // Колонка — порядковый номер слота: биты одного слота стоят друг над другом.
  const columnOfSlot = new Map<number, number>();
  for (const beat of ordered) {
    const slot = slots[beat.id];
    if (slot != null && !columnOfSlot.has(slot)) columnOfSlot.set(slot, columnOfSlot.size);
  }

  const orderOfBeat = new Map(spine.beats.map((b, index) => [b.id, index + 1]));

  const nodes: BlueprintNode[] = ordered.map(beat => {
    const slot = slots[beat.id] ?? null;
    const dimmed = !guardFlags(beat.guard).every(flag => reachable.has(flag));
    const beatIssues = issuesForBeat(issues, beat.id);
    const hasProse = Boolean(spineBeatProse[beat.id]);

    let state: BeatCardState;
    if (dimmed && !hasProse) state = 'locked';
    else if (beatIssues.some(i => i.severity === 'error') || slot == null) state = 'failed';
    else if (hasProse) state = 'done';
    else if (runPhase === 'beat_prose') state = 'running';
    else state = 'failed';

    return {
      id: beat.id,
      // Кикер держим коротким: подробное окно и участники — в инспекторе.
      kicker:
        slot == null
          ? `Б${orderOfBeat.get(beat.id)} · слот не назначен`
          : `Б${orderOfBeat.get(beat.id)} · ${slotLabel(slot, calendar)}`,
      title: `${BEAT_KIND_GLYPH[beat.kind]} ${truncate(beat.summary || beat.id, 70)}`,
      state,
      dimmed,
      slot,
      act: slot == null ? beat.act : actOfSlot(slot, calendar),
      column: slot == null ? columnOfSlot.size : columnOfSlot.get(slot) ?? 0,
      lane: laneOfBeat(beat),
      issues: beatIssues,
      beat,
    };
  });

  const known = new Set(nodes.map(n => n.id));
  const edges: BlueprintEdge[] = [];
  const seen = new Set<string>();

  for (const beat of spine.beats) {
    // Сплошные связи — порядок хребта внутри сюжетной линии.
    for (const from of chain.predecessors.get(beat.id) ?? []) {
      const key = `${from}→${beat.id}`;
      if (!known.has(from) || seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to: beat.id, branch: false });
    }
    // Пунктирные — исход развилки, открывающий этот бит.
    for (const flag of guardFlags(beat.guard)) {
      const owner = outcomeOwner.get(flag);
      if (!owner || !known.has(owner.beatId)) continue;
      const key = `${owner.beatId}⇢${beat.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: owner.beatId, to: beat.id, branch: true, label: owner.label });
    }
  }

  return {
    nodes,
    edges,
    columns: Math.max(1, columnOfSlot.size + (nodes.some(n => n.slot == null) ? 1 : 0)),
    lanes: Math.max(1, nextLane),
  };
}
