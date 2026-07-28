import React from 'react';

import ArtifactRow from '@/ui/kit/molecules/ArtifactRow';

import styles from './shell.module.css';

import type { PipelineModel, ZoneRow } from '../derive/pipelineModel';
import type { ArtifactMark as RowMark } from '@/ui/kit/molecules/ArtifactRow';
import type { ZoneId } from './zoneModel';

export interface SidebarPipelineProps {
  model: PipelineModel;
  current: ZoneId;
  onPickZone: (zone: ZoneId) => void;
}

/**
 * Вкладка «Пайплайн»: весь конвейер разом — что готово, что протухло, чего
 * ещё нет. Наверху шелла видна только текущая зона, поэтому ответ на вопрос
 * «сколько мне ещё работы» живёт именно здесь.
 */
const SidebarPipeline = ({ model, current, onPickZone }: SidebarPipelineProps) => (
  <div>
    <div className={styles.kicker}>Конвейер</div>
    {model.zones.map(zone => (
      <ZoneBlock key={zone.id} zone={zone} active={zone.id === current} onPick={() => onPickZone(zone.id)} />
    ))}
  </div>
);

const ZoneBlock = ({ zone, active, onPick }: { zone: ZoneRow; active: boolean; onPick: () => void }) => (
  <div className={styles.section}>
    <button
      type="button"
      className={[styles.zoneRow, active ? styles.zoneRowActive : ''].filter(Boolean).join(' ')}
      onClick={onPick}
    >
      <span>{zone.label}</span>
      <span className={styles.zoneRowCounts}>{counts(zone)}</span>
    </button>

    {zone.rows.map(row => (
      <ArtifactRow key={row.key} artifactName={rowName(row.stage, row.item)} mark={markOf(row)} />
    ))}
  </div>
);

/** «3/5» — сделано из общего. У пустой зоны считать нечего. */
function counts(zone: ZoneRow): string {
  if (zone.total === 0) return '—';
  return zone.stale > 0 ? `${zone.fresh}/${zone.total} · ◐${zone.stale}` : `${zone.fresh}/${zone.total}`;
}

function rowName(stage: string, item: string): string {
  return item ? `${stage} · ${item}` : stage;
}

/**
 * Ведомость различает «протухло» и «протухло, но авторское»; молекула из кита
 * знает только четыре отметки, и авторское в ней — отдельная, самая сильная.
 */
function markOf(row: { freshness: string; ownership: string }): RowMark {
  if (row.freshness === 'missing') return 'none';
  if (row.freshness === 'stale') return 'stale';
  return row.ownership === 'authored' || row.ownership === 'locked' ? 'authored' : 'fresh';
}

export default SidebarPipeline;
