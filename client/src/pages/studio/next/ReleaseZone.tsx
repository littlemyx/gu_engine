import React, { useMemo, useState } from 'react';

import { useArtifactStore } from '@/artifacts/artifactStore';
import { ownershipLabel } from '@/artifacts/transitions';
import EmptyState from '@/ui/kit/molecules/EmptyState';
import GateBlockerRow from '@/ui/kit/molecules/GateBlockerRow';
import PassportKV from '@/ui/kit/molecules/PassportKV';
import ReleaseActions, { type ReleaseAction } from '@/ui/kit/molecules/ReleaseActions';
import ReleaseCard from '@/ui/kit/molecules/ReleaseCard';
import ReleasePassport from '@/ui/kit/molecules/ReleasePassport';

import { zoneStateLabel } from '../derive/pipelineModel';

import styles from './shell.module.css';
import own from './ReleaseZone.module.css';

import type { ArtifactMeta, Freshness } from '@/artifacts/types';
import type { ArtifactRow, PipelineModel } from '../derive/pipelineModel';

export interface ReleaseZoneProps {
  pipeline: PipelineModel;
}

export interface GateBlocker {
  id: string;
  text: string;
}

const FRESHNESS_RU: Record<Freshness, string> = { fresh: 'свежий', stale: 'устарел', missing: 'не создан' };

// Действия релиза не имеют реализации в сторах (нет ни скачивания бандла, ни
// восстановления релиза черновиком) — поэтому колбэков у пунктов нет, и
// `ReleaseActions` рисует их как инертные подписи, как молекула и задумана
// для непроводнённого случая.
const RELEASE_ACTION_ITEMS: ReleaseAction[] = [
  { label: '▶ Играть' },
  { label: 'Скачать .gu.json' },
  { label: 'Восстановить как черновик', accent: true },
];

/**
 * Гейт релиза: за что цепляется сборка, если хоть одна зона до релиза не
 * готова или в конвейере есть протухшее. Зона «Релиз» намеренно не судит
 * саму себя — её собственные строки (`bundle`/`release`) это то, что гейт
 * защищает, а не то, что его блокирует.
 */
export function deriveGateBlockers(pipeline: PipelineModel): GateBlocker[] {
  const blockers: GateBlocker[] = [];

  for (const zone of pipeline.zones) {
    if (zone.id === 'release') continue;
    // Зоны без стадий («Превью») никогда не станут «готовы» — это не блокер.
    if (zone.total === 0) continue;
    if (zone.state !== 'ready') {
      blockers.push({
        id: `zone:${zone.id}`,
        text: `«${zone.label}» — ${zoneStateLabel(zone.state)} (${zone.fresh}/${zone.total} свежих)`,
      });
    }
  }

  if (pipeline.totalStale > 0) {
    blockers.push({
      id: 'stale',
      text: `Устарело артефактов: ${pipeline.totalStale} — сборка не имеет права взять протухшее без перегона.`,
    });
  }

  return blockers;
}

/** Готовые релизы: непустые строки стадии `release` в одноимённой зоне. */
export function deriveReleaseRows(pipeline: PipelineModel): ArtifactRow[] {
  const zone = pipeline.zones.find(z => z.id === 'release');
  if (!zone) return [];
  return zone.rows.filter(row => row.stage === 'release' && !row.placeholder);
}

function releaseStats(row: ArtifactRow, meta: ArtifactMeta | undefined): string[] {
  if (!meta) return [];
  const stats = [`владение ${ownershipLabel(meta.ownership)}`, `дублей ${meta.takes.length} · №${meta.selectedTake}`];
  if (meta.provenance?.cost != null) stats.push(`стоил ≈$${meta.provenance.cost.toFixed(2)}`);
  return stats;
}

function passportLines(row: ArtifactRow, meta: ArtifactMeta | undefined): string[] {
  const lines = [`версия: ${row.item || '—'}`, `состояние: ${FRESHNESS_RU[row.freshness]}`];
  if (meta) {
    lines.push(`владение: ${ownershipLabel(meta.ownership)}`);
    lines.push(`дублей: ${meta.takes.length} · выбран №${meta.selectedTake}`);
  }
  return lines;
}

/**
 * Зона 6 «Релиз»: честный гейт — что мешает собрать релиз, паспорт готовой
 * сборки и действия над ней.
 *
 * Своего стора у релиза пока нет: сборка бандла и восстановление в черновик
 * не реализованы нигде в проекте. Экран поэтому либо показывает список
 * блокеров и пустое состояние (релизов ещё не было), либо — когда в ведомости
 * конвейера уже есть строки стадии `release` — карточки готовых релизов с
 * паспортом выбранного.
 */
const ReleaseZone = ({ pipeline }: ReleaseZoneProps) => {
  const artifactIndex = useArtifactStore(s => s.index);

  const blockers = useMemo(() => deriveGateBlockers(pipeline), [pipeline]);
  const releaseRows = useMemo(() => deriveReleaseRows(pipeline), [pipeline]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedRow = releaseRows.find(r => r.key === selectedKey) ?? releaseRows[0];
  const selectedMeta = selectedRow ? artifactIndex[selectedRow.key] : undefined;

  const gateOpen = blockers.length === 0;

  return (
    <div className={styles.zoneBody}>
      <h1 className={styles.zoneHeading}>Релиз</h1>
      <p className={styles.zoneHint}>
        честный гейт: чего не хватает для сборки
        {releaseRows.length > 0 ? ` · собрано релизов: ${releaseRows.length}` : ''}
      </p>

      <div className={styles.section}>
        <div className={styles.kicker}>Гейт</div>
        {gateOpen ? (
          <p className={styles.empty}>Блокеров нет — конвейер готов к сборке релиза.</p>
        ) : (
          blockers.map(blocker => <GateBlockerRow key={blocker.id} text={blocker.text} action="" />)
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.kicker}>Релизы</div>

        {releaseRows.length === 0 ? (
          <EmptyState
            title="Релизов ещё нет"
            hint={gateOpen ? 'гейт открыт — можно собрать первый релиз' : 'сначала закройте блокеры выше'}
            actionLabel="Собрать релиз"
            actionKind={gateOpen ? 'primary' : 'outline'}
          />
        ) : (
          <>
            <div className={own.grid}>
              {releaseRows.map(row => (
                <ReleaseCard
                  key={row.key}
                  title={row.item || row.key}
                  badge={FRESHNESS_RU[row.freshness]}
                  stats={releaseStats(row, artifactIndex[row.key])}
                  tone={selectedRow?.key === row.key ? 'accent' : 'обычная'}
                  onClick={() => setSelectedKey(row.key)}
                />
              ))}
            </div>

            {selectedRow && (
              <div className={own.detail}>
                <ReleasePassport lines={passportLines(selectedRow, selectedMeta)} />
                <PassportKV
                  rows={[
                    { key: 'версия', value: selectedRow.item || '—', format: 'mono' },
                    { key: 'состояние', value: FRESHNESS_RU[selectedRow.freshness], format: 'accent' },
                    {
                      key: 'владение',
                      value: selectedMeta ? ownershipLabel(selectedMeta.ownership) : '—',
                    },
                  ]}
                  onDark
                />
                <ReleaseActions items={RELEASE_ACTION_ITEMS} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReleaseZone;
