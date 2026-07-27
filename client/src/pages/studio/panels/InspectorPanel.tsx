import React from 'react';

import AudioRunInspector from '../inspector/AudioRunInspector';
import BeatInspector from '../inspector/BeatInspector';
import CharacterInspector from '../inspector/CharacterInspector';
import EmptyInspector from '../inspector/EmptyInspector';
import LocationInspector from '../inspector/LocationInspector';
import PrefabInspector from '../inspector/PrefabInspector';
import RunInspector from '../inspector/RunInspector';
import SlotInspector from '../inspector/SlotInspector';
import UnitInspector from '../inspector/UnitInspector';
import { useStudioStore } from '../studioStore';

import styles from './panels.module.css';

import type { BlueprintModel } from '../derive/blueprintModel';
import type { ScoreModel } from '../derive/scoreModel';
import type { AudioRunInspectorProps } from '../inspector/AudioRunInspector';
import type { RunInspectorProps } from '../inspector/RunInspector';
import type { ImageGenState } from '@/narrative/narrativeStore';
import type { AnchorBeat } from '@/narrative/types';

export interface InspectorPanelProps {
  blueprint: BlueprintModel | null;
  score: ScoreModel | null;
  spineBeatProse: Record<string, AnchorBeat>;
  images: Record<string, ImageGenState>;
  locationNames: Record<string, string>;
  running: boolean;
  /** Идёт генерация медиа: кнопки инспекторов заперты. */
  mediaBusy: boolean;
  mediaDisabledReason?: string;
  /** Свернуть панель. Без обработчика кнопка не рисуется (оверлей на узком). */
  onCollapse?: () => void;
  onGenerateBackgrounds: () => void;
  onGenerateSprites: () => void;
  /** «Сохранить как префаб» — открывает модалку по текущему выделению. */
  onSavePrefab: () => void;
  onPrefabApplied: (message: string) => void;
  run: RunInspectorProps;
  audioRun: AudioRunInspectorProps;
}

const KIND_TITLE: Record<string, string> = {
  beat: 'Бит',
  slot: 'Слот',
  character: 'Персонаж',
  location: 'Локация',
  prefab: 'Префаб',
  unit: 'Юнит',
  run: 'Прогон',
  audioRun: 'Аудио',
};

/**
 * Правый рейл — единственный канал деталей: что бы ни выделили в иерархии,
 * вьюпорте или доке, подробности показываются здесь.
 */
const InspectorPanel = ({
  blueprint,
  score,
  spineBeatProse,
  images,
  locationNames,
  running,
  mediaBusy,
  mediaDisabledReason,
  onCollapse,
  onGenerateBackgrounds,
  onGenerateSprites,
  onSavePrefab,
  onPrefabApplied,
  run,
  audioRun,
}: InspectorPanelProps) => {
  const selection = useStudioStore(s => s.selection);

  const beatNode = selection?.kind === 'beat' ? blueprint?.nodes.find(n => n.id === selection.id) ?? null : null;

  return (
    <aside className={styles.inspector}>
      <div className={styles.panelHead}>
        <span>Инспектор{selection ? ` · ${KIND_TITLE[selection.kind] ?? ''}` : ''}</span>
        {onCollapse && (
          <button type="button" className={styles.panelCollapse} onClick={onCollapse} title="Свернуть панель">
            ›
          </button>
        )}
      </div>
      <div className={styles.inspectorBody}>
        {selection == null && <EmptyInspector />}

        {selection?.kind === 'beat' &&
          (beatNode ? (
            <BeatInspector
              node={beatNode}
              prose={spineBeatProse[beatNode.beat.id]}
              locationName={locationNames[beatNode.beat.locationId] ?? beatNode.beat.locationId}
              image={images[`loc:${beatNode.beat.locationId}`]}
              running={running}
            />
          ) : (
            <div className={styles.placeholder}>Бит не найден в текущем хребте.</div>
          ))}

        {selection?.kind === 'slot' && <SlotInspector charId={selection.charId} slot={selection.slot} score={score} />}

        {selection?.kind === 'character' && (
          <CharacterInspector
            id={selection.id}
            onGenerateSprite={onGenerateSprites}
            onSavePrefab={onSavePrefab}
            running={mediaBusy || running}
            disabledReason={mediaDisabledReason}
          />
        )}

        {selection?.kind === 'location' && (
          <LocationInspector
            id={selection.id}
            onGenerateBackground={onGenerateBackgrounds}
            onSavePrefab={onSavePrefab}
            running={mediaBusy || running}
            disabledReason={mediaDisabledReason}
          />
        )}

        {selection?.kind === 'unit' && (
          <UnitInspector unitId={selection.unitId} bracket={selection.bracket} running={running} />
        )}

        {selection?.kind === 'run' && <RunInspector {...run} />}

        {selection?.kind === 'audioRun' && <AudioRunInspector {...audioRun} />}

        {selection?.kind === 'prefab' && <PrefabInspector id={selection.id} onApplied={onPrefabApplied} />}
      </div>
    </aside>
  );
};

export default InspectorPanel;
