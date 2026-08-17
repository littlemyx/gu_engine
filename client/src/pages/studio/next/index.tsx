import React, { useMemo, useState } from 'react';

import { useArtifactStore } from '@/artifacts/artifactStore';
import { useArtifacts } from '@/artifacts/useArtifacts';
import { useBriefStore } from '@/narrative/briefStore';
import { requestStopCalendarRun } from '@/narrative/calendarRunner';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { useBulkCalendarGeneration } from '@/narrative/useBulkCalendarGeneration';
import { useStoryQA } from '@/narrative/useStoryQA';
import { buildCallSheet, runPlanOf } from '@/processes/callSheet';
import { runCommand, useEventBus } from '@/processes/eventBus';
import { eventText } from '@/processes/events';
import { phaseLabel } from '@/processes/runMachine';
import BottomTabs from '@/ui/kit/molecules/BottomTabs';
import MenuBar from '@/ui/kit/molecules/MenuBar';
import MenuPanel from '@/ui/kit/molecules/MenuPanel';
import StatusBar from '@/ui/kit/molecules/StatusBar';
import ToolbarActions from '@/ui/kit/molecules/ToolbarActions';
import ToolbarStatus from '@/ui/kit/molecules/ToolbarStatus';
import ZoneSwitcher from '@/ui/kit/molecules/ZoneSwitcher';

import { derivePipeline } from '../derive/pipelineModel';
import { deriveStructure } from '../derive/structureModel';
import ModalHost from '../modals/ModalHost';
import PrefabsPanel from '../panels/PrefabsPanel';
import { useProjectFile } from '../projectFile/useProjectFile';
import PanelResizer from '../shell/PanelResizer';
import { useStudioStore } from '../studioStore';
import { useStudioActions } from '../useStudioActions';
import ArtifactInspector from './ArtifactInspector';
import CallSheetPanel from './CallSheetPanel';
import ConsequencesModal from './ConsequencesModal';
import RunsPanel from './RunsPanel';
import { buildMenu, runMenuItem } from './menuModel';
import { prefabConsequences } from './prefabConsequences';
import SidebarPipeline from './SidebarPipeline';
import SidebarStructure from './SidebarStructure';
import ZoneView from './ZoneView';
import { ZONES, nextZone, zoneById, zoneLabel } from './zoneModel';

import styles from './shell.module.css';

import type { StageCost } from '@/processes/callSheet';
import type { ArtifactKey, ArtifactStage } from '@/artifacts/types';
import type { Prefab } from '@/prefabs/prefabTypes';
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

/**
 * Стадии, которые календарный прогон произведёт с нуля. Бриф — вход прогона,
 * а не продукт; медиа, проверка и релиз запускаются из своих зон. Смета
 * считает по этому списку то, чего ещё нет, — иначе на пустом проекте кнопка
 * обещала бы пересчёт брифа за копейки и молчала про всю историю.
 */
const RUN_STAGES: ArtifactStage[] = [
  'cast',
  'world',
  'calendar',
  'spine',
  'schedule',
  'beat_prose',
  'anchor_transitions',
  'event_pool',
  'dialogue_units',
  'ending_prose',
];

const BOTTOM_TABS: { id: BottomTab; label: string }[] = [
  { id: 'pipeline', label: 'Пайплайн' },
  { id: 'feed', label: 'Лента' },
  { id: 'runs', label: 'Прогоны' },
  { id: 'prefabs', label: 'Префабы' },
];

/** Позы генерируются в зоне «Медиа»: колл-щит меню их не запускает. */
const NO_POSE_GEN = {
  status: { state: 'idle' } as const,
  poseStatuses: {},
  onStart: () => {},
  disabledReason: 'позы генерируются в зоне «Медиа»',
};

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
  const setPanelSize = useStudioStore(s => s.setPanelSize);
  const resetPanelSizes = useStudioStore(s => s.resetPanelSizes);
  const openModal = useStudioStore(s => s.openModal);

  const [zoneListOpen, setZoneListOpen] = useState(false);
  // Выделение артефакта живёт в сессии: после перезагрузки разумнее открыть
  // чистый инспектор, чем ссылаться на позицию, которой уже нет.
  const [picked, setPicked] = useState<ArtifactRow | null>(null);
  // Однострочное уведомление в статус-баре: что сделал последний поступок.
  // Файловые операции сыплют сюда прогресс — без этого «Сохранить» выглядит
  // как ничего не сделавший пункт меню.
  const [notice, setNotice] = useState<string | null>(null);
  // Вставка префаба на паузе: показываем последствия, применение — в proceed.
  const [pendingApply, setPendingApply] = useState<{ prefab: Prefab; proceed: () => void } | null>(null);

  const { index, owns } = useArtifacts();
  const brief = useBriefStore(s => s.brief);
  const narrative = useNarrativeStore();
  const run = useEventBus(s => s.run);
  const feed = useEventBus(s => s.recent);

  const calendarGen = useBulkCalendarGeneration();
  const qa = useStoryQA();
  const projectFile = useProjectFile(setNotice);
  const { exportGate, exportBundle, archiveDraft } = useStudioActions();

  // Прогон идёт — источник истины тот же, что у старого шелла: фаза
  // календарного прогона, а не событие ленты. Прогон переживает перезагрузку
  // (initNarrative дожимает его мимо этого экрана), машина событий — нет.
  const running = calendarGen.phase !== 'idle' && calendarGen.phase !== 'done' && !calendarGen.error;
  // Колл-щит показывается ДО запуска: смету подписывают, а не узнают из бегущей
  // консоли, когда деньги уже потрачены. Открыт ли он — состояние машины
  // прогона, а не отдельный флаг: иначе «идёт ли прогон» опять считалось бы
  // двумя способами.
  const callSheetOpen = run.phase === 'callsheet';

  const pipeline = useMemo(() => derivePipeline({ index, owns }), [index, owns]);
  // Смета на кнопке — тот же расчёт, что покажет колл-щит перед запуском:
  // цифра в тулбаре и цифра в подписи обязаны совпадать до копейки.
  const sheet = useMemo(
    () => buildCallSheet({ index, owns, cost: STAGE_COST, expectMissing: RUN_STAGES }),
    [index, owns],
  );
  // План машины — позиции сметы, а не девять стадий пайплайна: прогресс-полоса
  // считает то же, что автор подписал.
  const openCallSheet = () => runCommand({ type: 'plan', total: sheet.generate.length });
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

  // Последствия вставки считаются той же сметой, что и всё остальное:
  // плейсхолдеры несозданного одинаковы в «до» и «после» и в дельту не попадают.
  const applyPreview = useMemo(
    () =>
      pendingApply
        ? prefabConsequences(pendingApply.prefab, brief, { index, owns, cost: STAGE_COST, expectMissing: RUN_STAGES })
        : null,
    [pendingApply, brief, index, owns],
  );

  // Имя проекта живёт в хребте: у брифа названия нет — оно сочиняется вместе
  // с историей, а не задаётся до неё.
  const projectName = narrative.spine?.title ?? 'без названия';

  const current = zoneById(zone);
  const ahead = nextZone(zone);

  // Экспорт: чистый гейт качает бандл сразу, заблокированный — открывает
  // модалку с причинами, где обход есть, но требует осознанного чекбокса.
  const menu = buildMenu({
    running,
    projectBusy: projectFile.busy,
    hasStory: narrative.spine != null,
    hasDraft: calendarGen.hasDraft,
    exportBlocked: !exportGate.ok,
    sidebarTab,
    bottomTab,
    dockOpen,
    onNewProject: () => openModal({ kind: 'newProject' }),
    onOpenProject: () => void projectFile.pickAndStageOpen(),
    // Вкладка без ?project= показывает пикер: там и живёт список проектов.
    onSwitchProject: () => window.location.assign('/studio-next'),
    onSaveProject: () => void projectFile.saveProject(),
    onSaveProjectAs: () => void projectFile.saveProjectAs(),
    onOpenBrief: () => openModal({ kind: 'brief' }),
    onImportBrief: () => openModal({ kind: 'importBrief' }),
    onDiscardDraft: () => openModal({ kind: 'resetDraft' }),
    onExport: () => (exportGate.ok ? exportBundle() : openModal({ kind: 'exportBlocked' })),
    onRun: openCallSheet,
    onStop: () => {
      requestStopCalendarRun();
      runCommand({ type: 'stop' });
    },
    onCheckStory: () => {
      setZone('qa');
      void qa.run(brief);
    },
    onSidebarTab: setSidebarTab,
    onBottomTab: setBottomTab,
    onToggleDock: toggleDock,
  });

  return (
    <div className={styles.shell}>
      <MenuBar
        items={menu}
        logoText="GU ENGINE"
        project={projectName}
        onPick={(column, label) => runMenuItem(menu, column, label)}
      />

      <div className={styles.toolbar}>
        <span className={styles.zonePicker}>
          <ZoneSwitcher
            kickerLabel="Зона"
            zoneLabel={zoneLabel(current)}
            open={zoneListOpen}
            onToggle={() => setZoneListOpen(v => !v)}
          />
          {zoneListOpen && (
            <span className={styles.zoneMenu}>
              {/* Без кикера: заголовок панели рисуется НАД ней и налезает на
                  вкладки боковой панели под тулбаром. */}
              <MenuPanel
                width={220}
                items={ZONES.map(z => ({
                  label: zoneLabel(z),
                  mark: z.id === zone ? 'radio' : 'none',
                }))}
                onPick={i => {
                  setZone(ZONES[i].id);
                  setZoneListOpen(false);
                }}
              />
            </span>
          )}
        </span>
        <ToolbarStatus text={statusText(pipeline)} tone={pipeline.totalStale > 0 ? 'error' : 'normal'} />
        <span className={styles.toolbarNote}>пайплайн целиком — во вкладке «Пайплайн» нижней панели</span>
        <ToolbarActions
          label={ahead ? `Продолжить: ${ahead.ru}` : 'Собрать релиз'}
          price={sheet.total > 0 ? `≈$${sheet.total.toFixed(2)}` : 'бесплатно'}
          previewLabel="Превью"
          previewActive={zone === 'preview'}
          disabled={running}
          loading={running}
          onRun={openCallSheet}
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

        <PanelResizer
          axis="x"
          size={railWidth}
          label="Ширина боковой панели"
          style={{ left: railWidth }}
          onResize={value => setPanelSize('rail', value)}
          onReset={resetPanelSizes}
        />

        <main className={styles.viewport}>
          <ZoneView zone={current} pipeline={pipeline} brief={brief} />
        </main>

        <PanelResizer
          axis="x"
          size={inspectorWidth}
          invert
          label="Ширина инспектора"
          style={{ right: inspectorWidth }}
          onResize={value => setPanelSize('inspector', value)}
          onReset={resetPanelSizes}
        />

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
        {dockOpen && (
          <PanelResizer
            axis="y"
            size={dockHeight}
            invert
            label="Высота дока"
            style={{ top: 0 }}
            onResize={value => setPanelSize('dock', value)}
            onReset={resetPanelSizes}
          />
        )}
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
            {bottomTab === 'runs' && <RunsPanel />}
            {bottomTab === 'prefabs' && (
              <PrefabsPanel
                hasStory={narrative.spine != null}
                onApplied={setNotice}
                confirmApply={(prefab, proceed) => setPendingApply({ prefab, proceed })}
              />
            )}
          </div>
        )}
      </div>

      {callSheetOpen && (
        <div className={styles.modalLayer}>
          <CallSheetPanel
            callSheet={sheet}
            signing={running}
            stageCost={STAGE_COST}
            onCancel={() => runCommand({ type: 'cancel' })}
            onSign={decided => {
              const plan = runPlanOf(sheet, decided);
              // «Дубль» на запертой строке — осознанный слом замка: без снятия
              // учёт (onGenerated) откажется принять новый дубль, а данные к
              // тому моменту уже перезаписаны.
              for (const key of plan.force) {
                if (index[key]?.ownership === 'locked') useArtifactStore.getState().unlock(key as ArtifactKey);
              }
              // Подпись и есть запуск: смету подписывают, чтобы прогон пошёл, а
              // не чтобы переключить экран. Продолжение черновика, не force —
              // ведомость уже решила, что считать устаревшим.
              runCommand({ type: 'sign' });
              setZone(pipeline.nextIncomplete ?? zone);
              void calendarGen.run(brief, { plan });
            }}
          />
        </div>
      )}

      {pendingApply && applyPreview && (
        <div className={styles.modalLayer}>
          <ConsequencesModal
            title={`${pendingApply.prefab.name} v${pendingApply.prefab.version} → в проект`}
            consequences={applyPreview}
            onConfirm={() => {
              pendingApply.proceed();
              setPendingApply(null);
            }}
            onCancel={() => setPendingApply(null)}
          />
        </div>
      )}

      <ModalHost
        exportGate={exportGate}
        onExportAnyway={exportBundle}
        onDiscardDraft={() => calendarGen.discardDraft()}
        onArchiveDraft={archiveDraft}
        onOpenQaReport={() => setZone('qa')}
        onNotify={setNotice}
        audioGen={{ onGenerate: () => setZone('media'), disabledReason: 'аудио запускается в зоне «Медиа»' }}
        poseGen={NO_POSE_GEN}
      />

      <StatusBar
        items={[
          { text: phaseLabel(run.phase), emphasis: run.phase !== 'idle' },
          ...(notice ? [{ text: notice, tone: 'info' as const }] : []),
          { text: `зона: ${current.ru}` },
          { text: pipeline.totalStale > 0 ? `устарело: ${pipeline.totalStale}` : 'всё свежее' },
        ]}
        right={
          running
            ? `прогон · ${calendarGen.phase} · ${calendarGen.progress.completed}/${calendarGen.progress.total}`
            : run.total > 0
            ? `${run.completed}/${run.total} · ≈$${run.spent.toFixed(2)}`
            : undefined
        }
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
