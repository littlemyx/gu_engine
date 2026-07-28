import React from 'react';

import ReadinessRow from '@/ui/kit/molecules/ReadinessRow';

import IdeaZone from './IdeaZone';

import styles from './shell.module.css';

import type { Brief } from '@/narrative/types';
import type { PipelineModel } from '../derive/pipelineModel';
import type { Zone } from './zoneModel';

export interface ZoneViewProps {
  zone: Zone;
  pipeline: PipelineModel;
  brief: Brief;
}

/**
 * Рабочая область текущей зоны.
 *
 * Пока это шапка с готовностью: экраны зон подключаются по одному, и каркас
 * не должен ждать, пока будет готов последний из них. Заглушка честно
 * называет, чего ещё нет, — это лучше пустого места, по которому непонятно,
 * сломалось что-то или так задумано.
 */
const ZoneView = ({ zone, pipeline, brief }: ZoneViewProps) => {
  if (zone.id === 'idea') return <IdeaZone brief={brief} />;

  const row = pipeline.zones.find(z => z.id === zone.id);

  return (
    <div className={styles.zoneBody}>
      <h1 className={styles.zoneHeading}>{zone.ru}</h1>
      <p className={styles.zoneHint}>{zone.hint}</p>

      {row && row.total > 0 && (
        <div className={styles.section}>
          <div className={styles.kicker}>Готовность зоны</div>
          {row.rows.map(artifact => (
            <ReadinessRow
              key={artifact.key}
              text={artifact.item ? `${artifact.stage} · ${artifact.item}` : artifact.stage}
              state={artifact.freshness === 'fresh' ? 'done' : artifact.freshness === 'stale' ? 'problem' : 'waiting'}
            />
          ))}
        </div>
      )}

      <div className={styles.stub}>Экран зоны «{zone.ru}» ещё не подключён.</div>
    </div>
  );
};

export default ZoneView;
