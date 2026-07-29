import React, { useMemo, useState } from 'react';

import { useArtifacts } from '@/artifacts/useArtifacts';
import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { buildCallSheet } from '@/processes/callSheet';
import { useEventBus } from '@/processes/eventBus';
import { eventText } from '@/processes/events';
import { phaseLabel } from '@/processes/runMachine';
import BottomTabs from '@/ui/kit/molecules/BottomTabs';
import MenuBar from '@/ui/kit/molecules/MenuBar';
import StatusBar from '@/ui/kit/molecules/StatusBar';
import ToolbarActions from '@/ui/kit/molecules/ToolbarActions';
import ToolbarStatus from '@/ui/kit/molecules/ToolbarStatus';
import ZoneSwitcher from '@/ui/kit/molecules/ZoneSwitcher';

import { derivePipeline } from '../derive/pipelineModel';
import { deriveStructure } from '../derive/structureModel';
import { useStudioStore } from '../studioStore';
import ArtifactInspector from './ArtifactInspector';
import CallSheetPanel from './CallSheetPanel';
import SidebarPipeline from './SidebarPipeline';
import SidebarStructure from './SidebarStructure';
import ZoneView from './ZoneView';
import { ZONES, nextZone, zoneById, zoneLabel } from './zoneModel';

import styles from './shell.module.css';

import type { StageCost } from '@/processes/callSheet';
import type { ArtifactRow } from '../derive/pipelineModel';
import type { BottomTab, SidebarTab } from '../studioStore';

/**
 * Порядок цен стадий. Пока это грубая шкала «во сколько раз одно дороже
 * другого» — точные суммы придут из costModel, когда колл-щит начнёт считать
 * по числу элементов, а не по стадии целиком.
 */
const STAGE_COST: StageCost = {
  brief: 0.02,
  cast: 0.2,
  world: 0.3,
  calendar: 0.5,
  spine: 1.2,
  schedule: 0.4,
  beat_prose: 0.6,
  anchor_transitions: 0.3,
  event_pool: 0.8,
  dialogue_units: 1.5,
  ending_prose: 0.5,
  image: 0.04,
  audio: 0.3,
  qa: 0.2,
  bundle: 0,
  release: 0,
};

const MENU = [
  { name: 'Файл', items: [{ label: 'Новый проект…' }, { label: 'Открыть…' }, { label: 'Сохранить' }] },
  { name: 'Правка', items: [{ label: 'Бриф истории…' }] },
  { name: 'Проект', items: [{ label: 'Префабы…' }, { label: 'Экспорт игры' }] },
  { name: 'Прогон', items: [{ label: 'Продолжить конвейер' }, { label: 'Остановить', separator: true }] },
  { name: 'Вид', items: [{ label: 'Структура' }, { label: 'Пайплайн' }] },
];

const BOTTOM_TABS: { id: BottomTab; label: string }[] = [
  { id: 'pipeline', label: 'Пайплайн' },
  { id: 'feed', label: 'Лента' },
  { id: 'runs', label: 'Прогоны' },
];

/**
 * Шелл «Конвейер».
 *
 * Живёт на отдельном адресе, пока строится: рабочая студия не должна падать
 * из-за наполовину собранного экрана. Данных не хранит — всё выводится
 * derive-функциями из сторов, как и в старом шелле.
 */
const StudioNext = () => {
  const zone = useStudioStore(s => s.zone);
  const setZone = useStudioStore(s => s.setZone);
  const sidebarTab = useStudioStore(s => s.sidebarTab);
  const setSidebarTab = useStudioStore(s => s.setSidebarTab);
  const bottomTab = useStudioStore(s => s.bottomTab);
  const setBottomTab = useStudioStore(s => s.setBottomTab);
  const dockOpen = useStudioStore(s => s.dockOpen);
  const toggleDock = useStudioStore(s => s.toggleDock);
  const railWidth = useStudioStore(s => s.railWidth);
  const inspectorWidth = useStudioStore(s => s.inspectorWidth);
  const dockHeight = useStudioStore(s => s.dockHeight);

  const [zoneListOpen, setZoneListOpen] = useState(false);
  // Выделение артефакта живёт в сессии: после перезагрузки разумнее открыть
  // чистый инспектор, чем ссылаться на позицию, которой уже нет.
  const [picked, setPicked] = useState<ArtifactRow | null>(null);
  // Колл-щит показывается ДО запуска: смету подписывают, а не узнают из
  // бегущей консоли, когда деньги уже потрачены.
  const [callSheetOpen, setCallSheetOpen] = useState(false);

  const { index, owns } = useArtifacts();
  const brief = useBriefStore(s => s.brief);
  const narrative = useNarrativeStore();
  const run = useEventBus(s => s.run);
  const feed = useEventBus(s => s.recent);

  const pipeline = useMemo(() => derivePipeline({ index, owns }), [index, owns]);
  // Смета на кнопке — тот же расчёт, что покажет колл-щит перед запуском:
  // цифра в тулбаре и цифра в подписи обязаны совпадать до копейки.
  const sheet = useMemo(() => buildCallSheet({ index, owns, cost: STAGE_COST }), [index, owns]);
  const structure = useMemo(
    () =>
      deriveStructure({
        brief,
        spine: narrative.spine,
        calendar: narrative.calendar,
        eventUnits: narrative.eventUnits,
        unitProse: narrative.unitProse,
        spineBeatProse: narrative.spineBeatProse,
      }),
    [brief, narrative],
  );

  // Имя проекта живёт в хребте: у брифа названия нет — оно сочиняется вместе
  // с историей, а не задаётся до неё.
  const projectName = narrative.spine?.title ?? 'без названия';

  const current = zoneById(zone);
  const ahead = nextZone(zone);

  return (
    <div className={styles.shell}>
      <MenuBar items={MENU} logoText="GU ENGINE" project={projectName} />

      <div className={styles.toolbar}>
        <ZoneSwitcher
          kickerLabel="Зона"
          zoneLabel={zoneLabel(current)}
          open={zoneListOpen}
          onToggle={() => setZoneListOpen(v => !v)}
        />
        <ToolbarStatus text={statusText(pipeline)} tone={pipeline.totalStale > 0 ? 'error' : 'normal'} />
        <span className={styles.toolbarNote}>пайплайн целиком — во вкладке «Пайплайн» нижней панели</span>
        <ToolbarActions
          label={ahead ? `Продолжить: ${ahead.ru}` : 'Собрать релиз'}
          price={sheet.total > 0 ? `≈$${sheet.total.toFixed(2)}` : 'бесплатно'}
          previewLabel="Превью"
          onRun={() => setCallSheetOpen(true)}
          onPreview={() => setZone('preview')}
        />
      </div>

      <div className={styles.body} style={{ gridTemplateColumns: `${railWidth}px minmax(0, 1fr) ${inspectorWidth}px` }}>
        <aside className={styles.sidebar}>
          <SidebarTabsStrip tab={sidebarTab} onPick={setSidebarTab} />
          <div className={styles.sidebarBody}>
            {sidebarTab === 'pipeline' ? (
              <SidebarPipeline model={pipeline} current={zone} onPickZone={setZone} onPickArtifact={setPicked} />
            ) : (
              <SidebarStructure nodes={structure} />
            )}
          </div>
        </aside>

        <main className={styles.viewport}>
          <ZoneView zone={current} pipeline={pipeline} brief={brief} />
        </main>

        <aside className={styles.inspector}>
          {picked ? (
            <ArtifactInspector row={picked} />
          ) : (
            <>
              <div className={styles.kicker}>Инспектор</div>
              <p className={styles.empty}>Выделите позицию в ведомости — детали появятся здесь.</p>
            </>
          )}
        </aside>
      </div>

      <div className={styles.dock} style={{ height: dockOpen ? dockHeight : 'auto' }}>
        <BottomTabs
          tabs={BOTTOM_TABS.map(t => ({ label: t.label }))}
          active={BOTTOM_TABS.findIndex(t => t.id === bottomTab)}
          collapsed={!dockOpen}
          onPick={i => (dockOpen && BOTTOM_TABS[i].id === bottomTab ? toggleDock() : setBottomTab(BOTTOM_TABS[i].id))}
        />
        {dockOpen && (
          <div className={styles.dockBody}>
            {bottomTab === 'pipeline' && (
              <SidebarPipeline model={pipeline} current={zone} onPickZone={setZone} onPickArtifact={setPicked} />
            )}
            {bottomTab === 'feed' && <Feed events={feed} />}
            {bottomTab === 'runs' && <p className={styles.empty}>Прогонов ещё не было.</p>}
          </div>
        )}
      </div>

      {callSheetOpen && (
        <CallSheetPanel
          callSheet={sheet}
          onCancel={() => setCallSheetOpen(false)}
          onSign={() => {
            setCallSheetOpen(false);
            // Прогон отсюда пока не запускается: зона «Генерация» показывает
            // ленту, а запуск остаётся за старым шеллом до врезки.
            setZone(pipeline.nextIncomplete ?? zone);
          }}
        />
      )}

      <StatusBar
        items={[
          { text: phaseLabel(run.phase), emphasis: run.phase !== 'idle' },
          { text: `зона: ${current.ru}` },
          { text: pipeline.totalStale > 0 ? `устарело: ${pipeline.totalStale}` : 'всё свежее' },
        ]}
        right={run.total > 0 ? `${run.completed}/${run.total} · ≈$${run.spent.toFixed(2)}` : undefined}
      />
    </div>
  );
};

const SidebarTabsStrip = ({ tab, onPick }: { tab: SidebarTab; onPick: (t: SidebarTab) => void }) => (
  <div className={styles.toolbar}>
    {(['structure', 'pipeline'] as SidebarTab[]).map(id => (
      <button
        key={id}
        type="button"
        className={[styles.zoneRow, tab === id ? styles.zoneRowActive : ''].filter(Boolean).join(' ')}
        onClick={() => onPick(id)}
      >
        {id === 'structure' ? 'Структура' : 'Пайплайн'}
      </button>
    ))}
  </div>
);

const Feed = ({ events }: { events: ReturnType<typeof useEventBus.getState>['recent'] }) => {
  if (events.length === 0) return <p className={styles.empty}>Лента пуста — прогон ещё не запускали.</p>;

  return (
    <div>
      {events.map(event => (
        <div key={event.id} className={styles.feedLine}>
          <span className={styles.feedTime}>{new Date(event.ts).toLocaleTimeString('ru')}</span>
          <span>{eventText(event)}</span>
        </div>
      ))}
    </div>
  );
};

function statusText(pipeline: ReturnType<typeof derivePipeline>): string {
  const ready = pipeline.zones.filter(z => z.state === 'ready').length;
  const total = ZONES.filter(z => z.id !== 'preview').length;
  return pipeline.totalStale > 0 ? `устарело позиций: ${pipeline.totalStale}` : `зон готово: ${ready}/${total}`;
}

export default StudioNext;
