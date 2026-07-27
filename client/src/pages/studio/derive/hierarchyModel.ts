import { assignBeatSlots } from '@/narrative/beatSchedule';
import { slotLabel } from '@/narrative/calendarTypes';

import type { BulkCalendarPhase } from '@/narrative/calendarRunState';
import type { Calendar, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit } from '@/narrative/dialogueUnit';
import type { AnchorBeat, Brief, SegmentIssue } from '@/narrative/types';
import type { HierarchyRowState } from '@/ui/HierarchyRow';

import type { AudioModel, AudioRowStatus } from './audioModel';
import type { Selection } from '../studioStore';

/** Строка дерева «Иерархия истории» — уже готовая к рендеру. */
export type HierarchyNode = {
  key: string;
  label: string;
  meta: string;
  icon: string;
  depth: number;
  state: HierarchyRowState;
  selection: Selection;
};

export type HierarchyInputs = {
  brief: Brief;
  spine: SpinePlan | null;
  calendar: Calendar | null;
  eventUnits: Record<string, EventUnit>;
  unitProse: Record<string, DialogueUnit[]>;
  spineBeatProse: Record<string, AnchorBeat>;
  issues?: SegmentIssue[];
  runPhase?: BulkCalendarPhase | null;
  /** Банк аудио: узел «♪ Аудио» с под-статусами (макет 7a). null — не показывать. */
  audio?: AudioModel | null;
};

const BEAT_ICON = '◈';
const CHAR_ICON = '◐';
const UNIT_ICON = '›';
const GROUP_ICON = '▸';

/** Сбой по scope: `spine/beats/<id>/…`, `dialogue/<unitId>/…`, `qa/prose/<unitId>`. */
export function failedIds(issues: SegmentIssue[]): Set<string> {
  const ids = new Set<string>();
  for (const issue of issues) {
    if (issue.severity !== 'error') continue;
    const parts = issue.scope.split('/');
    const beatAt = parts.indexOf('beats');
    if (beatAt >= 0 && parts[beatAt + 1]) ids.add(parts[beatAt + 1]);
    if (parts[0] === 'dialogue' && parts[1]) ids.add(parts[1]);
    if (parts[0] === 'qa' && parts[1] === 'prose' && parts[2]) ids.add(parts[2]);
  }
  return ids;
}

/**
 * Дерево история → бит → персонаж → группа юнитов → юнит.
 * Персонажи берутся из брифа, юниты группируются по своей ступени арки.
 */
/** Состояние группы аудио-строк для дерева: ошибка > генерация > пусто > норма. */
function audioGroupState(statuses: AudioRowStatus[], done: number): HierarchyRowState {
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('generating')) return 'running';
  return done === 0 ? 'dim' : 'normal';
}

export function deriveHierarchy(inputs: HierarchyInputs): HierarchyNode[] {
  const {
    brief,
    spine,
    calendar,
    eventUnits,
    unitProse,
    spineBeatProse,
    issues = [],
    runPhase = null,
    audio = null,
  } = inputs;

  const failed = failedIds(issues);
  const nodes: HierarchyNode[] = [];

  const title = spine?.title || 'История без хребта';
  nodes.push({
    key: 'story',
    label: title,
    meta: calendar ? `${calendar.days} дн · ${calendar.slotCount} слотов` : 'нет календаря',
    icon: '▣',
    depth: 0,
    state: 'normal',
    selection: null,
  });

  // ── Биты хребта ──────────────────────────────────────────────────────────
  if (spine && calendar) {
    const slots = assignBeatSlots(spine, calendar);
    const beats = [...spine.beats].sort((a, b) => (slots[a.id] ?? 1e9) - (slots[b.id] ?? 1e9));
    for (const beat of beats) {
      const slot = slots[beat.id];
      const hasProse = Boolean(spineBeatProse[beat.id]);
      const state: HierarchyRowState = failed.has(beat.id)
        ? 'failed'
        : !hasProse && runPhase === 'beat_prose'
        ? 'running'
        : hasProse
        ? 'normal'
        : 'dim';
      nodes.push({
        key: `beat:${beat.id}`,
        label: beat.summary || beat.id,
        meta: slot == null ? '—' : slotLabel(slot, calendar),
        icon: BEAT_ICON,
        depth: 1,
        state,
        selection: { kind: 'beat', id: beat.id },
      });
    }
  }

  // ── Персонажи и их юниты ─────────────────────────────────────────────────
  const unitsByChar = new Map<string, EventUnit[]>();
  for (const unit of Object.values(eventUnits)) {
    const charId = unit.participants[0];
    if (!charId) continue;
    const list = unitsByChar.get(charId) ?? [];
    list.push(unit);
    unitsByChar.set(charId, list);
  }

  for (const li of brief.loveInterests) {
    const units = unitsByChar.get(li.id) ?? [];
    const withProse = units.filter(u => (unitProse[u.id]?.length ?? 0) > 0).length;
    nodes.push({
      key: `char:${li.id}`,
      label: li.name || li.id,
      meta: units.length === 0 ? 'нет юнитов' : `${withProse}/${units.length}`,
      icon: CHAR_ICON,
      depth: 1,
      state: units.some(u => failed.has(u.id)) ? 'failed' : 'normal',
      selection: { kind: 'character', id: li.id },
    });

    // Группа = ступень арки: так дерево читается как лестница отношений.
    const byStage = new Map<number, EventUnit[]>();
    for (const unit of units) {
      const stage = unit.arcStage ?? 0;
      const list = byStage.get(stage) ?? [];
      list.push(unit);
      byStage.set(stage, list);
    }

    for (const stage of [...byStage.keys()].sort((a, b) => a - b)) {
      const group = byStage.get(stage) ?? [];
      nodes.push({
        key: `group:${li.id}:${stage}`,
        label: stage === 0 ? 'без ступени' : `Ступень ${stage}`,
        meta: `${group.length}`,
        icon: GROUP_ICON,
        depth: 2,
        state: 'normal',
        selection: null,
      });

      for (const unit of group) {
        const brackets = unitProse[unit.id]?.length ?? 0;
        const state: HierarchyRowState = failed.has(unit.id)
          ? 'failed'
          : brackets === 0 && runPhase === 'dialogue_units'
          ? 'running'
          : brackets === 0
          ? 'dim'
          : 'normal';
        nodes.push({
          key: `unit:${unit.id}`,
          label: unit.id,
          meta: brackets === 0 ? '—' : `${brackets}×`,
          icon: UNIT_ICON,
          depth: 3,
          state,
          selection: { kind: 'unit', unitId: unit.id },
        });
      }
    }
  }

  // ── Аудио-банк ───────────────────────────────────────────────────────────
  if (audio) {
    const selection: Selection = { kind: 'audioRun' };
    nodes.push({
      key: 'audio',
      label: 'Аудио',
      meta: `${audio.done}/${audio.total} готово`,
      icon: '♪',
      depth: 1,
      state: audio.failed ? 'failed' : audio.generating ? 'running' : audio.done === 0 ? 'dim' : 'normal',
      selection,
    });

    const moodRows = audio.moodRows.filter(r => r.status !== 'unused');
    const specialRows = audio.specialRows.filter(r => r.status !== 'unused');
    const sfxFailed = audio.sfxChips.filter(c => c.status === 'failed').length;

    nodes.push(
      {
        key: 'audio:base',
        label: 'Подложка',
        meta: audio.base.status === 'done' ? '✓' : audio.base.statusText ?? '—',
        icon: '›',
        depth: 2,
        state: audioGroupState([audio.base.status], audio.phases.base.done),
        selection,
      },
      {
        key: 'audio:beds',
        label: 'Эмбиенты',
        meta: `${moodRows.filter(r => r.status === 'done').length}/${moodRows.length}`,
        icon: '›',
        depth: 2,
        state: audioGroupState(
          moodRows.map(r => r.status),
          moodRows.filter(r => r.status === 'done').length,
        ),
        selection,
      },
      {
        key: 'audio:special',
        label: 'Диегетика',
        meta: `${specialRows.filter(r => r.status === 'done').length}/${specialRows.length}`,
        icon: '›',
        depth: 2,
        state: audioGroupState(
          specialRows.map(r => r.status),
          specialRows.filter(r => r.status === 'done').length,
        ),
        selection,
      },
      {
        key: 'audio:variations',
        label: 'Вариации LI',
        meta: `${audio.phases.variations.done}/${audio.phases.variations.total}`,
        icon: '›',
        depth: 2,
        state: audioGroupState(
          audio.variationRows.flatMap(r => [r.warm.status, r.cold.status]),
          audio.phases.variations.done,
        ),
        selection,
      },
      {
        key: 'audio:sfx',
        label: 'SFX',
        meta: sfxFailed > 0 ? `${sfxFailed} ошибка` : `${audio.phases.sfx.done}/${audio.phases.sfx.total}`,
        icon: '›',
        depth: 2,
        state: audioGroupState(
          audio.sfxChips.map(c => (c.status === 'missing' ? 'unused' : c.status)),
          audio.phases.sfx.done,
        ),
        selection,
      },
    );
  }

  return nodes;
}
