import React from 'react';

import ActionButton from '@/ui/ActionButton';
import { IconBlueprint, IconMap, IconScore, IconScript } from '@/ui/icons';

import { useStudioProjectStore } from '../studioProjectStore';
import { useStudioStore } from '../studioStore';

import AudioView from './AudioView';
import BlueprintView from './BlueprintView';
import RelationsView from './RelationsView';
import ScoreView from './ScoreView';
import ScriptView from './ScriptView';
import WorldMapView from './WorldMapView';

import styles from './viewport.module.css';

import type { AudioModel } from '../derive/audioModel';
import type { BlueprintModel } from '../derive/blueprintModel';
import type { RelationsModel } from '../derive/relationsModel';
import type { ScoreModel } from '../derive/scoreModel';
import type { ScriptModel } from '../derive/scriptModel';
import type { WorldMapModel } from '../derive/worldMapModel';
import type { ViewportTab } from '../studioStore';

const TABS: { id: ViewportTab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'blueprint', label: 'Чертёж', Icon: IconBlueprint },
  { id: 'score', label: 'Партитура', Icon: IconScore },
  { id: 'script', label: 'Сценарий', Icon: IconScript },
  { id: 'world', label: 'Карта мира', Icon: IconMap },
];

/**
 * Пустое состояние всегда называет фазу прогона, которая создаст содержимое,
 * и ведёт к ней (макет 7h): у вкладок без данных CTA возвращает к чертежу.
 */
const EMPTY_STATE: Record<ViewportTab, { title: string; hint: string }> = {
  blueprint: { title: 'Чертёж пуст', hint: 'хребта ещё нет — его строит генерация плана' },
  score: { title: 'Календаря нет', hint: 'партитура появится после фаз worldCalendar и schedule' },
  script: { title: 'Сценарий пуст', hint: 'проза появится после фаз beatProse и dialogueUnits' },
  world: { title: 'Карты нет', hint: 'карта появится после фазы worldCalendar — вместе с моделью мира' },
  audio: { title: 'Банк аудио пуст', hint: 'банк строится по модели мира — она появится после фазы worldCalendar' },
  relations: { title: 'Отношений нет', hint: 'присутствие и покрытие появятся после фазы schedule' },
};

export interface ViewportProps {
  blueprint: BlueprintModel | null;
  score: ScoreModel | null;
  script: ScriptModel | null;
  worldMap: WorldMapModel | null;
  audio: { model: AudioModel; baseStyle: string } | null;
  relations: { model: RelationsModel; onSeedUnits: () => void; seedDisabledReason?: string } | null;
}

/** Центральная область: четыре постоянные вкладки + закрываемая «Аудио». */
const Viewport = ({ blueprint, score, script, worldMap, audio, relations }: ViewportProps) => {
  const tab = useStudioStore(s => s.viewportTab);
  const setTab = useStudioStore(s => s.setViewportTab);
  const audioTabOpen = useStudioStore(s => s.audioTabOpen);
  const openAudioTab = useStudioStore(s => s.openAudioTab);
  const closeAudioTab = useStudioStore(s => s.closeAudioTab);
  const relationsTabOpen = useStudioStore(s => s.relationsTabOpen);
  const openRelationsTab = useStudioStore(s => s.openRelationsTab);
  const closeRelationsTab = useStudioStore(s => s.closeRelationsTab);
  const setBracket = useStudioProjectStore(s => s.setScriptBracket);

  const empty = (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>{EMPTY_STATE[tab].title}</div>
      {EMPTY_STATE[tab].hint}
      {tab !== 'blueprint' && (
        <div className={styles.emptyAction}>
          <ActionButton onLight kind="outline" label="К чертежу" onClick={() => setTab('blueprint')} />
        </div>
      )}
    </div>
  );

  return (
    <main className={styles.root}>
      <div className={styles.tabs}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        {audioTabOpen && (
          <span className={`${styles.tab} ${tab === 'audio' ? styles.tabActive : ''}`}>
            <button type="button" className={styles.tabInner} onClick={openAudioTab}>
              ♪ Аудио
            </button>
            <button type="button" className={styles.tabClose} title="Закрыть вкладку" onClick={closeAudioTab}>
              ✕
            </button>
          </span>
        )}
        {relationsTabOpen && (
          <span className={`${styles.tab} ${tab === 'relations' ? styles.tabActive : ''}`}>
            <button type="button" className={styles.tabInner} onClick={openRelationsTab}>
              Отношения
            </button>
            <button type="button" className={styles.tabClose} title="Закрыть вкладку" onClick={closeRelationsTab}>
              ✕
            </button>
          </span>
        )}
      </div>

      <div className={styles.body}>
        {tab === 'blueprint' && (blueprint ? <BlueprintView model={blueprint} /> : empty)}
        {tab === 'score' && (score ? <ScoreView model={score} /> : empty)}
        {tab === 'script' &&
          (script && script.total > 0 ? <ScriptView model={script} onBracketChange={setBracket} /> : empty)}
        {tab === 'world' && (worldMap && worldMap.nodes.length > 0 ? <WorldMapView model={worldMap} /> : empty)}
        {tab === 'audio' && (audio ? <AudioView model={audio.model} baseStyle={audio.baseStyle} /> : empty)}
        {tab === 'relations' &&
          (relations ? (
            <RelationsView
              model={relations.model}
              onSeedUnits={relations.onSeedUnits}
              seedDisabledReason={relations.seedDisabledReason}
            />
          ) : (
            empty
          ))}
      </div>
    </main>
  );
};

export default Viewport;
