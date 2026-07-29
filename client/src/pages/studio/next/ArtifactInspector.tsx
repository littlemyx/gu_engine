import React from 'react';

import { useArtifactStore } from '@/artifacts/artifactStore';
import { ownershipLabel } from '@/artifacts/transitions';

import styles from './shell.module.css';

import type { ArtifactRow } from '../derive/pipelineModel';

export interface ArtifactInspectorProps {
  row: ArtifactRow;
}

const FRESHNESS_RU = { fresh: 'свежий', stale: 'устарел', missing: 'не создан' } as const;

/**
 * Инспектор артефакта: чей он, из чего собран, какие были дубли — и четыре
 * решения, которые автор может принять, не запуская прогон.
 *
 * «Принять» и «Запереть» здесь, а не в меню, потому что решение принимается
 * глядя на конкретную позицию ведомости: запирают не «хребет вообще», а вот
 * этот удавшийся бит.
 */
const ArtifactInspector = ({ row }: ArtifactInspectorProps) => {
  const meta = useArtifactStore(s => s.index[row.key]);
  const approve = useArtifactStore(s => s.approve);
  const lock = useArtifactStore(s => s.lock);
  const unlock = useArtifactStore(s => s.unlock);
  const note = useArtifactStore(s => s.note);

  if (!meta) {
    return (
      <>
        <div className={styles.kicker}>{row.stage}</div>
        <p className={styles.empty}>Этой позиции ещё нет — она появится, когда до неё дойдёт конвейер.</p>
      </>
    );
  }

  return (
    <>
      <div className={styles.kicker}>{row.item ? `${row.stage} · ${row.item}` : row.stage}</div>

      <div className={styles.artifactLine}>
        <span>владение</span>
        <span className={styles.zoneRowCounts}>{ownershipLabel(meta.ownership)}</span>
      </div>
      <div className={styles.artifactLine}>
        <span>состояние</span>
        <span className={styles.zoneRowCounts}>{FRESHNESS_RU[row.freshness]}</span>
      </div>
      <div className={styles.artifactLine}>
        <span>дублей</span>
        <span className={styles.zoneRowCounts}>
          {meta.takes.length} · выбран №{meta.selectedTake}
        </span>
      </div>
      {meta.provenance?.cost != null && (
        <div className={styles.artifactLine}>
          <span>стоил</span>
          <span className={styles.zoneRowCounts}>≈${meta.provenance.cost.toFixed(2)}</span>
        </div>
      )}

      {row.needsDecision && (
        <p className={styles.empty}>
          Входы изменились, но переписывать нельзя: это ваш текст. Решите — принять машинную версию или оставить свою.
        </p>
      )}

      <div className={styles.section}>
        {meta.ownership === 'proposed' && (
          <button type="button" className={styles.zoneRow} onClick={() => approve(row.key)}>
            Принять
          </button>
        )}
        {meta.ownership === 'locked' ? (
          <button type="button" className={styles.zoneRow} onClick={() => unlock(row.key)}>
            Снять замок
          </button>
        ) : (
          <button type="button" className={styles.zoneRow} onClick={() => lock(row.key)}>
            Запереть — не трогать прогоном
          </button>
        )}
        <button
          type="button"
          className={styles.zoneRow}
          onClick={() => {
            const text = window.prompt('Заметка режиссёру — уедет в следующую генерацию:');
            if (text) note(row.key, text);
          }}
        >
          Заметка режиссёру
        </button>
      </div>

      {meta.notes.length > 0 && (
        <div className={styles.section}>
          <div className={styles.kicker}>Заметки к следующему дублю</div>
          {meta.notes.map((text, i) => (
            <div key={i} className={styles.artifactLine}>
              {text}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ArtifactInspector;
