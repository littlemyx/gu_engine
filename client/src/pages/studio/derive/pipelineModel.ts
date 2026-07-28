import { deriveAllFreshness, summarize } from '@/artifacts/freshness';
import { topoOrder } from '@/artifacts/stageGraph';

import { ZONES, zoneLabel } from '../next/zoneModel';

import type { ArtifactIndex, ArtifactKey, ArtifactStage, Freshness, Ownership } from '@/artifacts/types';
import { parseArtifactKey } from '@/artifacts/types';
import type { Zone, ZoneId } from '../next/zoneModel';

/**
 * Ведомость конвейера: что в каждой зоне готово, что протухло, чего нет.
 *
 * Сегодняшнее дерево иерархии смешивает две разные вещи — производственный
 * статус и структуру истории, — и потому не отвечает толком ни на «что мне
 * ещё предстоит», ни на «как устроена история». Эта модель отвечает на первый
 * вопрос; на второй отвечает `structureModel`.
 */

/** Знак состояния в ведомости: ● готово · ◐ протухло · ○ не создано. */
export type ArtifactMark = '●' | '◐' | '○';

export const MARK: Record<Freshness, ArtifactMark> = { fresh: '●', stale: '◐', missing: '○' };

export interface ArtifactRow {
  key: ArtifactKey;
  stage: ArtifactStage;
  /** Имя элемента внутри стадии; пусто у скалярных. */
  item: string;
  freshness: Freshness;
  ownership: Ownership;
  mark: ArtifactMark;
  /** Автор запретил трогать. */
  locked: boolean;
  /** Протухло, но переписывать нельзя без решения автора. */
  needsDecision: boolean;
  /**
   * Стадия, до которой ещё не дошли: артефакта нет вовсе, и строка нарисована
   * ведомостью, а не взята из индекса. Без неё непочатая зона выглядела бы
   * готовой — в индексе ведь нет ничего, что могло бы протухнуть.
   */
  placeholder: boolean;
}

export type ZoneState = 'empty' | 'ready' | 'stale' | 'partial';

export interface ZoneRow {
  id: ZoneId;
  label: string;
  hint: string;
  state: ZoneState;
  fresh: number;
  stale: number;
  missing: number;
  total: number;
  rows: ArtifactRow[];
}

export interface PipelineModel {
  zones: ZoneRow[];
  /** Первая зона, которой нужна работа: куда ведёт «Продолжить конвейер». */
  nextIncomplete: ZoneId | null;
  totalStale: number;
  totalMissing: number;
}

export interface PipelineInput {
  index: ArtifactIndex;
  owns?: Record<string, unknown>;
}

export function derivePipeline({ index, owns = {} }: PipelineInput): PipelineModel {
  const freshness = deriveAllFreshness(index, topoOrder(), owns);

  const zones = ZONES.map(zone => buildZone(zone, index, freshness));

  return {
    zones,
    // Превью пропускается: у него нет стадий, оно никогда не «доделывается».
    nextIncomplete: zones.find(z => z.state !== 'ready' && z.total > 0)?.id ?? null,
    totalStale: zones.reduce((sum, z) => sum + z.stale, 0),
    totalMissing: zones.reduce((sum, z) => sum + z.missing, 0),
  };
}

function buildZone(zone: Zone, index: ArtifactIndex, freshness: Record<string, Freshness>): ZoneRow {
  const keys = Object.keys(index).filter(key => zone.stages.includes(parseArtifactKey(key as ArtifactKey).stage));

  const rows = keys.map((key): ArtifactRow => {
    const meta = index[key];
    const { stage, item } = parseArtifactKey(key as ArtifactKey);
    const state = freshness[key] ?? 'missing';
    const locked = meta.ownership === 'locked';

    return {
      key: key as ArtifactKey,
      stage,
      item,
      freshness: state,
      ownership: meta.ownership,
      mark: MARK[state],
      locked,
      needsDecision: state === 'stale' && (locked || meta.ownership === 'authored'),
      placeholder: false,
    };
  });

  const started = new Set(rows.map(r => r.stage));
  const untouched = zone.stages.filter(stage => !started.has(stage)).map(placeholderRow);

  const all = [...rows, ...untouched].sort((a, b) => a.key.localeCompare(b.key));
  const counts = { ...summarize(freshness, keys), missing: 0, total: 0 };
  counts.missing = all.filter(r => r.freshness === 'missing').length;
  counts.total = all.length;

  return {
    id: zone.id,
    label: zoneLabel(zone),
    hint: zone.hint,
    state: zoneState(counts),
    fresh: counts.fresh,
    stale: counts.stale,
    missing: counts.missing,
    total: counts.total,
    rows: all,
  };
}

function placeholderRow(stage: ArtifactStage): ArtifactRow {
  return {
    key: `${stage}/` as ArtifactKey,
    stage,
    item: '',
    freshness: 'missing',
    ownership: 'proposed',
    mark: MARK.missing,
    locked: false,
    needsDecision: false,
    placeholder: true,
  };
}

function zoneState(counts: { fresh: number; stale: number; missing: number; total: number }): ZoneState {
  // Зона без артефактов пуста, а не готова: «Превью» и нетронутые зоны не
  // должны выглядеть сделанными только потому, что в них нечего считать.
  if (counts.total === 0) return 'empty';
  if (counts.fresh === counts.total) return 'ready';
  // Протухание важнее нехватки: оно означает, что работа была и пропала.
  if (counts.stale > 0) return 'stale';
  return counts.fresh === 0 ? 'empty' : 'partial';
}

export function zoneStateLabel(state: ZoneState): string {
  const LABELS: Record<ZoneState, string> = {
    empty: 'не начата',
    ready: 'готово',
    stale: 'устарело',
    partial: 'частично',
  };
  return LABELS[state];
}
