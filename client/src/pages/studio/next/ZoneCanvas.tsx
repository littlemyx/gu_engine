import React, { useState } from 'react';

import BlueprintView from '../viewport/BlueprintView';
import RelationsView from '../viewport/RelationsView';
import ScoreView from '../viewport/ScoreView';
import ScriptView from '../viewport/ScriptView';
import WorldMapView from '../viewport/WorldMapView';
import { useStudioProjectStore } from '../studioProjectStore';
import ProseZone from './ProseZone';
import { useZoneViews } from './useZoneViews';

import styles from './shell.module.css';

import type { ZoneId } from './zoneModel';

/**
 * Существующие вью, разложенные по зонам.
 *
 * Чертёж, партитура и карта мира — это разные взгляды на структуру, поэтому
 * они живут в зоне «Структура» вкладками. Сценарий — читаемый результат
 * генерации, и его место в зоне «Генерация». Переписывать сами вью ради
 * нового шелла незачем: они и так тупые, им всё равно, кто их разместил.
 */
const TABS: Partial<Record<ZoneId, { id: string; label: string }[]>> = {
  structure: [
    { id: 'blueprint', label: 'Чертёж' },
    { id: 'score', label: 'Партитура' },
    { id: 'world', label: 'Карта мира' },
    { id: 'relations', label: 'Отношения' },
  ],
  prose: [
    { id: 'run', label: 'Прогон' },
    { id: 'script', label: 'Сценарий' },
  ],
};

export interface ZoneCanvasProps {
  zone: ZoneId;
  /** Что показать, если у зоны своего полотна ещё нет. */
  fallback: React.ReactNode;
}

const ZoneCanvas = ({ zone, fallback }: ZoneCanvasProps) => {
  const tabs = TABS[zone] ?? [];
  const [tab, setTab] = useState(tabs[0]?.id ?? '');
  const setBracket = useStudioProjectStore(s => s.setScriptBracket);
  const { blueprint, score, script, worldMap, relations } = useZoneViews();

  if (tabs.length === 0) return <>{fallback}</>;

  const active = tabs.some(t => t.id === tab) ? tab : tabs[0].id;

  return (
    <div>
      {tabs.length > 1 && (
        <div className={styles.toolbar}>
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              className={[styles.zoneRow, active === t.id ? styles.zoneRowActive : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active === 'blueprint' && (blueprint ? <BlueprintView model={blueprint} /> : <Nothing what="чертежа" />)}
      {active === 'score' && (score ? <ScoreView model={score} /> : <Nothing what="партитуры" />)}
      {active === 'world' &&
        (worldMap && worldMap.nodes.length > 0 ? <WorldMapView model={worldMap} /> : <Nothing what="карты мира" />)}
      {active === 'relations' &&
        (relations ? (
          // Догенерация юнитов — действие прогона, а не вью; в конвейере его
          // место в колл-щите, поэтому здесь колбэк пустой.
          <RelationsView model={relations} onSeedUnits={() => undefined} />
        ) : (
          <Nothing what="отношений" />
        ))}
      {active === 'run' && <ProseZone />}
      {active === 'script' &&
        (script && script.total > 0 ? (
          <ScriptView model={script} onBracketChange={setBracket} />
        ) : (
          <Nothing what="сценария" />
        ))}
    </div>
  );
};

/** Честно называет, чего именно не хватает, а не показывает пустое место. */
const Nothing = ({ what }: { what: string }) => (
  <div className={styles.stub}>Для {what} нужен собранный каркас — соберите его в зоне «Структура».</div>
);

export default ZoneCanvas;
