import React, { useMemo, useState } from 'react';

import { isBlankBrief, useBriefStore } from '@/narrative/briefStore';
import { isCalendarRunActive, requestStopCalendarRun } from '@/narrative/calendarRunner';
import { estimateRunCost, formatCost, useRunCost } from '@/narrative/costModel';
import { deriveLegacyOutline } from '@/narrative/deriveLegacyOutline';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { appendRunLog } from '@/narrative/runLog';
import { buildBaseStyle, useBulkAudioGeneration } from '@/narrative/useBulkAudioGeneration';
import { useBulkCalendarGeneration } from '@/narrative/useBulkCalendarGeneration';
import { useBulkCharacterGeneration } from '@/narrative/useBulkCharacterGeneration';
import { useBulkImageGeneration } from '@/narrative/useBulkImageGeneration';
import { useRegeneratePoses } from '@/narrative/useRegeneratePoses';
import { useStoryQA } from '@/narrative/useStoryQA';
import { validateBrief } from '@/narrative/validateBrief';
import { usePrefabStore } from '@/prefabs/prefabStore';
import { pluralize } from '@/ui/plural';
import ShellToolbar from '@/ui/ShellToolbar';
import StatusBar from '@/ui/StatusBar';

import { deriveAudioModel } from './derive/audioModel';
import { deriveBlueprint } from './derive/blueprintModel';
import { deriveHierarchy } from './derive/hierarchyModel';
import { deriveRelations } from './derive/relationsModel';
import { deriveScore } from './derive/scoreModel';
import { deriveScript } from './derive/scriptModel';
import { deriveWorldMap } from './derive/worldMapModel';
import Dock from './panels/Dock';
import HierarchyPanel from './panels/HierarchyPanel';
import InspectorPanel from './panels/InspectorPanel';
import EmptyProject from './modals/EmptyProject';
import ModalHost from './modals/ModalHost';
import { useProjectFile } from './projectFile/useProjectFile';
import BranchPicker from './shell/BranchPicker';
import CollapsedPanel from './shell/CollapsedPanel';
import SeedPicker from './shell/SeedPicker';
import IconRail from './shell/IconRail';
import PanelResizer from './shell/PanelResizer';
import MenuBar from './shell/MenuBar';
import { buildMenuGroups } from './shell/menuConfig';
import { useStudioProjectStore } from './studioProjectStore';
import { useStudioStore } from './studioStore';
import { isNarrow, isReadonly, READONLY_REASON, useBreakpoint } from './useBreakpoint';
import { useStudioActions } from './useStudioActions';
import Viewport from './viewport/Viewport';

import styles from './studio.module.css';

import type { ShellMode } from '@/ui/ShellToolbar';

/** Клиент модели не знает — text_gen резолвит её на своей стороне. */
/** Ширина свёрнутой боковой панели: она остаётся колонкой сетки, просто узкой. */
const COLLAPSED_STRIP = 28;

const MODEL_STATUS = 'gpt-4.1-mini · text_gen · image_gen';

/** Шелл «Планирование и генерация»: меню, панель действий, три панели, статус. */
const Studio = () => {
  const brief = useBriefStore(s => s.brief);
  const spine = useNarrativeStore(s => s.spine);
  const calendar = useNarrativeStore(s => s.calendar);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const eventUnits = useNarrativeStore(s => s.eventUnits);
  const unitProse = useNarrativeStore(s => s.unitProse);
  const spineBeatProse = useNarrativeStore(s => s.spineBeatProse);
  const images = useNarrativeStore(s => s.images);
  const storyQA = useNarrativeStore(s => s.storyQA);

  const schedule = useNarrativeStore(s => s.schedule);
  const characters = useNarrativeStore(s => s.characters);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioMoodBeds = useNarrativeStore(s => s.audioMoodBeds);
  const audioSpecialBeds = useNarrativeStore(s => s.audioSpecialBeds);
  const audioByLi = useNarrativeStore(s => s.audioByLi);
  const audioSfx = useNarrativeStore(s => s.audioSfx);
  const audioSfxState = useNarrativeStore(s => s.audioSfxState);
  const clearAudio = useNarrativeStore(s => s.clearAudio);

  const calendarGen = useBulkCalendarGeneration();
  const qa = useStoryQA();
  const imageGen = useBulkImageGeneration();
  const characterGen = useBulkCharacterGeneration();
  const audioGen = useBulkAudioGeneration();
  const poseRegen = useRegeneratePoses();

  const branchAssignment = useStudioProjectStore(s => s.branchAssignment);
  const viewportTab = useStudioStore(s => s.viewportTab);
  const setViewportTab = useStudioStore(s => s.setViewportTab);
  const scriptBracket = useStudioProjectStore(s => s.scriptBracket);
  const select = useStudioStore(s => s.select);
  const selection = useStudioStore(s => s.selection);
  const dockTab = useStudioStore(s => s.dockTab);
  const dockOpen = useStudioStore(s => s.dockOpen);
  const railOpen = useStudioStore(s => s.railOpen);
  const inspectorOpen = useStudioStore(s => s.inspectorOpen);
  const railWidth = useStudioStore(s => s.railWidth);
  const inspectorWidth = useStudioStore(s => s.inspectorWidth);
  const dockHeight = useStudioStore(s => s.dockHeight);
  const toggleRail = useStudioStore(s => s.toggleRail);
  const toggleInspector = useStudioStore(s => s.toggleInspector);
  const toggleDock = useStudioStore(s => s.toggleDock);
  const setPanelSize = useStudioStore(s => s.setPanelSize);
  const resetPanelSizes = useStudioStore(s => s.resetPanelSizes);
  const setDockTab = useStudioStore(s => s.setDockTab);
  const openModal = useStudioStore(s => s.openModal);
  const openAudioTab = useStudioStore(s => s.openAudioTab);
  const openRelationsTab = useStudioStore(s => s.openRelationsTab);
  const resetBranches = useStudioProjectStore(s => s.resetBranches);
  const setBranch = useStudioProjectStore(s => s.setBranch);
  const setSeed = useBriefStore(s => s.setSeed);
  const resetToSample = useBriefStore(s => s.resetToSample);
  const prefabCount = usePrefabStore(s => s.prefabs.length);

  const breakpoint = useBreakpoint();
  const narrow = isNarrow(breakpoint);
  const readonly = isReadonly(breakpoint);
  // На узком экране дерево и инспектор всплывают поверх вьюпорта.
  const [treeOpen, setTreeOpen] = useState(false);
  const [overlayInspector, setOverlayInspector] = useState(false);

  // На компактном экране панели не шире канона компакта, даже если автор
  // растянул их на большом мониторе: место отдаётся вьюпорту.
  const railSize = breakpoint === 'compact' ? Math.min(railWidth, 220) : railWidth;
  const inspectorSize = breakpoint === 'compact' ? Math.min(inspectorWidth, 280) : inspectorWidth;

  const { exportGate, exportBundle, archiveDraft } = useStudioActions();
  const prefabLabel = prefabCount === 0 ? 'библиотека пуста' : pluralize(prefabCount, 'префаб', 'префаба', 'префабов');
  // Однострочное уведомление в статус-баре: что сделал последний поступок.
  const [notice, setNotice] = useState<string | null>(null);
  const projectFile = useProjectFile(setNotice);

  const running = calendarGen.phase !== 'idle' && calendarGen.phase !== 'done' && !calendarGen.error;
  const spent = useRunCost(s => s.spent);
  const estimate = useMemo(() => estimateRunCost(brief), [brief]);
  // validateBrief ходит по вложенным полям без проверок и падает на брифе с
  // отсутствующими секциями (импорт чужого файла). Раньше это роняло всю
  // студию; теперь на нём ещё и держится гейт генерации, так что молчаливое
  // «бриф сломан» — единственный безопасный исход.
  const briefIssues = useMemo(() => {
    try {
      return validateBrief(brief);
    } catch {
      return [{ severity: 'error' as const, path: 'brief', message: 'бриф заполнен не до конца' }];
    }
  }, [brief]);
  const briefBlocked = briefIssues.some(i => i.severity === 'error');
  const qaIssues = storyQA?.issues ?? [];
  const qaErrors = qaIssues.filter(i => i.severity === 'error').length;
  const qaWarnings = qaIssues.filter(i => i.severity === 'warning').length;

  const mode: ShellMode = running ? 'running' : !spine ? 'empty' : qaErrors > 0 ? 'blocked' : 'idle';

  const liIds = useMemo(() => brief.loveInterests.map(li => li.id), [brief.loveInterests]);

  const blueprint = useMemo(
    () =>
      spine && calendar
        ? deriveBlueprint({
            spine,
            calendar,
            spineBeatProse,
            liIds,
            branchAssignment,
            issues: qaIssues,
            runPhase: running ? calendarGen.phase : null,
          })
        : null,
    [spine, calendar, spineBeatProse, liIds, branchAssignment, qaIssues, running, calendarGen.phase],
  );

  const relations = useMemo(
    () =>
      spine && calendar && schedule
        ? deriveRelations({ brief, calendar, spine, schedule, eventUnits, unitProse })
        : null,
    [brief, calendar, spine, schedule, eventUnits, unitProse],
  );

  // CTA «Догенерировать юниты»: пустые брекеты уходят фидбеком в пулы событий
  // владеющих LI — best-of retry регенерирует их с этими строками.
  const seedMissingBrackets = () => {
    if (!relations || relations.problems.length === 0) return;
    const eventPool: Record<string, string[]> = {};
    for (const problem of relations.problems) {
      (eventPool[problem.liId] ??= []).push(problem.message);
    }
    void calendarGen.run(brief, { seedIssues: { eventPool } });
  };

  const audioModel = useMemo(
    () =>
      deriveAudioModel({
        brief,
        worldModel,
        audioBase,
        audioMoodBeds,
        audioSpecialBeds,
        audioByLi,
        audioSfx,
        audioSfxState,
      }),
    [brief, worldModel, audioBase, audioMoodBeds, audioSpecialBeds, audioByLi, audioSfx, audioSfxState],
  );
  // Стиль подложки живёт в шелле: правится в инспекторе запуска, показывается
  // во вкладке «Аудио»; null = дефолт из брифа.
  const [audioStyleOverride, setAudioStyleOverride] = useState<string | null>(null);
  const audioStyle = audioStyleOverride ?? buildBaseStyle(brief);

  const hierarchy = useMemo(
    () =>
      deriveHierarchy({
        brief,
        spine,
        calendar,
        eventUnits,
        unitProse,
        spineBeatProse,
        issues: qaIssues,
        runPhase: running ? calendarGen.phase : null,
        // Узел «♪ Аудио» появляется вместе с миром: раньше генерировать нечего.
        audio: worldModel ? audioModel : null,
      }),
    [
      brief,
      spine,
      calendar,
      eventUnits,
      unitProse,
      spineBeatProse,
      qaIssues,
      running,
      calendarGen.phase,
      worldModel,
      audioModel,
    ],
  );

  const score = useMemo(
    () =>
      spine && calendar && schedule
        ? deriveScore({
            brief,
            calendar,
            spine,
            schedule,
            worldModel,
            eventUnits,
            unitProse,
            spineBeatProse,
            branchAssignment,
            issues: qaIssues,
          })
        : null,
    [brief, calendar, spine, schedule, worldModel, eventUnits, unitProse, spineBeatProse, branchAssignment, qaIssues],
  );

  const script = useMemo(
    () =>
      spine && calendar
        ? deriveScript({
            brief,
            calendar,
            spine,
            worldModel,
            eventUnits,
            unitProse,
            spineBeatProse,
            bracket: scriptBracket,
            branchAssignment,
            issues: qaIssues,
          })
        : null,
    [
      brief,
      calendar,
      spine,
      worldModel,
      eventUnits,
      unitProse,
      spineBeatProse,
      scriptBracket,
      branchAssignment,
      qaIssues,
    ],
  );

  const worldMap = useMemo(
    () => deriveWorldMap({ worldModel, spine, calendar, eventUnits, images }),
    [worldModel, spine, calendar, eventUnits, images],
  );

  const locationNames = useMemo(
    () => Object.fromEntries((worldModel?.locations ?? []).map(l => [l.id, l.name])),
    [worldModel],
  );

  // ── Медиа-генерация ──────────────────────────────────────────────────────
  // Хуки фонов/спрайтов ждут легаси-outline: он выводится из хребта детерминированно.
  const legacyOutline = useMemo(
    () => (spine && calendar ? deriveLegacyOutline(spine, calendar, schedule, brief, worldModel).outline : null),
    [spine, calendar, schedule, brief, worldModel],
  );

  const mediaBusy =
    imageGen.status.state === 'running' ||
    characterGen.status.state === 'running' ||
    audioGen.status.state === 'running' ||
    poseRegen.status.state === 'running';
  const mediaDisabledReason = readonly
    ? READONLY_REASON
    : running
    ? 'идёт прогон истории'
    : legacyOutline == null
    ? 'истории ещё нет'
    : undefined;

  const generateBackgrounds = () => {
    if (legacyOutline) void imageGen.start(brief, legacyOutline);
  };
  // Запуск аудио: стиль подложки правится в инспекторе запуска аудио.
  const generateAudio = () => void audioGen.start(brief, audioStyle);
  const generateSprites = () => {
    if (legacyOutline) void characterGen.start(brief, legacyOutline);
  };
  const forceSprites = () => {
    if (legacyOutline) void characterGen.start(brief, legacyOutline, { force: true });
  };

  const assetsSummary = useMemo(() => {
    const locations = worldModel?.locations ?? [];
    const backgrounds = locations.filter(l => images[`loc:${l.id}`]?.status === 'done').length;
    const sprites = brief.loveInterests.filter(li => characters[li.id]?.status === 'done').length;
    return `фоны ${backgrounds}/${locations.length} · спрайты ${sprites}/${brief.loveInterests.length} · аудио ${
      audioBase?.status === 'done' ? 'есть' : 'нет'
    }`;
  }, [worldModel, images, brief.loveInterests, characters, audioBase]);

  // Экспорт: чистый гейт качает сразу, заблокированный — открывает модалку,
  // где обход есть, но требует осознанного чекбокса.
  const onExport = () => (exportGate.ok ? exportBundle() : openModal({ kind: 'exportBlocked' }));
  const canSavePrefab = selection?.kind === 'character' || selection?.kind === 'location';

  const menuGroups = useMemo(
    () =>
      buildMenuGroups({
        running: running || readonly,
        hasSpine: Boolean(spine),
        hasDraft: calendarGen.hasDraft,
        exportBlocked: !exportGate.ok,
        viewportTab,
        dockTab,
        dockOpen,
        setViewportTab,
        setDockTab,
        onGenerate: () => void calendarGen.run(brief, spine ? { force: true } : undefined),
        onContinueDraft: () => void calendarGen.run(brief),
        onCheckStory: () => void qa.run(brief),
        onDiscardDraft: () => openModal({ kind: 'resetDraft' }),
        onStop: requestStopCalendarRun,
        onOpenRun: () => select({ kind: 'run' }),
        onExport,
        onImportBrief: () => openModal({ kind: 'importBrief' }),
        onOpenBrief: () => openModal({ kind: 'brief' }),
        onOpenSelector: () => openModal({ kind: 'selector' }),
        onOpenLocationMoods: () => openModal({ kind: 'locationMoods' }),
        onOpenPoses: () => openModal({ kind: 'poses' }),
        onOpenAudio: openAudioTab,
        onOpenRelations: openRelationsTab,
        onNewProject: () => openModal({ kind: 'newProject' }),
        onOpenProject: () => void projectFile.pickAndStageOpen(),
        // Студия без ?project= показывает пикер: там и живёт список проектов.
        // Легаси остаётся в легаси: пикер общий, но адрес свой.
        onSwitchProject: () => window.location.assign('/studio-legacy'),
        onSaveProject: () => void projectFile.saveProject(),
        onSaveProjectAs: () => void projectFile.saveProjectAs(),
        projectBusy: projectFile.busy,
        onSavePrefab: () => openModal({ kind: 'savePrefab', from: selection }),
        canSavePrefab,
        onResetBranches: resetBranches,
        railOpen,
        inspectorOpen,
        onToggleRail: toggleRail,
        onToggleInspector: toggleInspector,
        onToggleDock: toggleDock,
        onResetPanels: resetPanelSizes,
        hasBranchChoice: Object.keys(branchAssignment).length > 0,
      }),
    [
      running,
      readonly,
      spine,
      calendarGen,
      exportGate.ok,
      viewportTab,
      dockTab,
      dockOpen,
      setViewportTab,
      setDockTab,
      brief,
      qa,
      select,
      openModal,
      selection,
      canSavePrefab,
      resetBranches,
      branchAssignment,
      projectFile,
      railOpen,
      inspectorOpen,
      toggleRail,
      toggleInspector,
      toggleDock,
      resetPanelSizes,
    ],
  );

  const statusItems = useMemo(() => {
    if (mode === 'running') {
      return [
        `прогон идёт · ${calendarGen.progress.completed}/${calendarGen.progress.total}`,
        `стадия ${calendarGen.phase}`,
        `потрачено ≈ ${formatCost(spent)}`,
      ];
    }
    if (notice) return [notice];
    if (mode === 'empty')
      return ['черновик пуст', briefBlocked ? 'бриф не заполнен' : 'бриф готов', `потрачено ≈ ${formatCost(spent)}`];
    const slots = calendar ? `слотов ${calendar.slotCount}` : 'слотов —';
    const events = `событий ${Object.keys(eventUnits).length}`;
    const qaText =
      storyQA == null || storyQA.state === 'idle'
        ? 'QA: не запускался после правок'
        : `QA: ${qaErrors} ошибок · ${qaWarnings} предупреждений`;
    return [`${slots} · ${events}`, qaText];
  }, [
    notice,
    mode,
    calendarGen.progress,
    calendarGen.phase,
    briefBlocked,
    calendar,
    eventUnits,
    storyQA,
    qaErrors,
    qaWarnings,
  ]);

  return (
    <div className={`${styles.shell} ${breakpoint === 'compact' ? styles.compact : narrow ? styles.narrow : ''}`}>
      <MenuBar groups={menuGroups} modelStatus={narrow ? undefined : MODEL_STATUS} burger={narrow} />

      {readonly && (
        <div className={styles.readonlyBanner}>◳ Только просмотр — редактирование от 1024px. Прогоны продолжаются.</div>
      )}

      <ShellToolbar
        mode={mode}
        compact={breakpoint !== 'canon'}
        readonly={readonly}
        canContinueDraft={calendarGen.hasDraft}
        branchControl={
          <BranchPicker spine={spine} assignment={branchAssignment} onPick={setBranch} onReset={resetBranches} />
        }
        progress={calendarGen.progress.total === 0 ? 0 : calendarGen.progress.completed / calendarGen.progress.total}
        meter={`${calendarGen.phase} · ${calendarGen.progress.completed}/${calendarGen.progress.total} · ≈ ${formatCost(
          spent,
        )} из ≈ ${formatCost(estimate)}`}
        qaSummary={`QA: ${qaErrors} ошибок · ${qaWarnings} предупреждений`}
        briefReady={!briefBlocked}
        briefReason={briefIssues.find(i => i.severity === 'error')?.message}
        onGenerate={() => void calendarGen.run(brief, spine ? { force: true } : undefined)}
        onContinueDraft={() => void calendarGen.run(brief)}
        onCheckStory={() => void qa.run(brief)}
        onRegenerateWithQa={() => void calendarGen.run(brief, { force: true })}
        onStop={requestStopCalendarRun}
        onExport={onExport}
        onImportBrief={() => openModal({ kind: 'importBrief' })}
        onOpenPrefabs={() => setDockTab('prefabs')}
      />

      <div
        className={styles.grid}
        // На узком экране колонки задаёт CSS: там рейл всегда 44px, а
        // инспектор вообще не колонка, а оверлей.
        style={
          narrow
            ? undefined
            : {
                gridTemplateColumns: `${railOpen ? railSize : COLLAPSED_STRIP}px minmax(0, 1fr) ${
                  inspectorOpen ? inspectorSize : COLLAPSED_STRIP
                }px`,
              }
        }
      >
        {narrow ? (
          <IconRail
            treeOpen={treeOpen}
            dockTab={dockTab}
            dockOpen={dockOpen}
            attention={{ assets: audioModel.failed, qa: qaErrors > 0 }}
            onToggleTree={() => setTreeOpen(open => !open)}
            onPickDock={tab => setDockTab(tab)}
          />
        ) : railOpen ? (
          <>
            <HierarchyPanel nodes={hierarchy} onPrefabApplied={setNotice} onCollapse={toggleRail} />
            <PanelResizer
              axis="x"
              size={railSize}
              label="Ширина иерархии"
              style={{ left: railSize }}
              onResize={(value: number) => setPanelSize('rail', value)}
              onReset={resetPanelSizes}
            />
          </>
        ) : (
          <CollapsedPanel side="left" label="Иерархия истории" attention={qaErrors > 0} onExpand={toggleRail} />
        )}

        {narrow && treeOpen && (
          <div className={styles.overlayTree}>
            <button type="button" className={styles.overlayClose} onClick={() => setTreeOpen(false)}>
              ✕
            </button>
            <HierarchyPanel nodes={hierarchy} onPrefabApplied={setNotice} />
          </div>
        )}
        <div className={styles.center}>
          {spine ? (
            <Viewport
              blueprint={blueprint}
              score={score}
              script={script}
              worldMap={worldMap}
              audio={worldModel ? { model: audioModel, baseStyle: audioStyle } : null}
              relations={
                relations
                  ? {
                      model: relations,
                      onSeedUnits: seedMissingBrackets,
                      seedDisabledReason: readonly ? READONLY_REASON : running ? 'идёт прогон истории' : undefined,
                    }
                  : null
              }
            />
          ) : (
            <EmptyProject
              disabledReason={readonly ? READONLY_REASON : undefined}
              briefReady={!briefBlocked}
              briefReason={briefIssues.find(i => i.severity === 'error')?.message}
              onFillBrief={() => openModal({ kind: 'brief' })}
              onGenerate={() => void calendarGen.run(brief)}
              onOpenPrefabs={() => setDockTab('prefabs')}
              onUseSample={
                isBlankBrief(brief)
                  ? () => {
                      resetToSample();
                      appendRunLog('info', 'подставлен образцовый бриф — университетская новелла, 3 персонажа');
                      setNotice('образец подставлен — бриф готов');
                    }
                  : undefined
              }
            />
          )}
        </div>
        {narrow && selection != null && !overlayInspector && (
          <button type="button" className={styles.inspectorHandle} onClick={() => setOverlayInspector(true)}>
            инспектор ›
          </button>
        )}

        {!narrow && !inspectorOpen && (
          <CollapsedPanel
            side="right"
            label="Инспектор"
            attention={Boolean(calendarGen.error) || audioModel.failed}
            onExpand={toggleInspector}
          />
        )}

        {!narrow && inspectorOpen && (
          <PanelResizer
            axis="x"
            size={inspectorSize}
            invert
            label="Ширина инспектора"
            style={{ right: inspectorSize }}
            onResize={(value: number) => setPanelSize('inspector', value)}
            onReset={resetPanelSizes}
          />
        )}

        {((!narrow && inspectorOpen) || (narrow && overlayInspector)) && (
          <div className={narrow ? styles.overlayInspector : styles.contents}>
            {narrow && (
              <button type="button" className={styles.overlayClose} onClick={() => setOverlayInspector(false)}>
                ✕
              </button>
            )}
            <InspectorPanel
              onCollapse={narrow ? undefined : toggleInspector}
              blueprint={blueprint}
              score={score}
              spineBeatProse={spineBeatProse}
              images={images}
              locationNames={locationNames}
              running={running}
              mediaBusy={mediaBusy}
              mediaDisabledReason={mediaDisabledReason}
              onGenerateBackgrounds={generateBackgrounds}
              onGenerateSprites={generateSprites}
              onSavePrefab={() => openModal({ kind: 'savePrefab', from: selection })}
              onPrefabApplied={setNotice}
              audioRun={{
                model: audioModel,
                status: audioGen.status,
                baseStyle: audioStyle,
                onBaseStyleChange: setAudioStyleOverride,
                disabledReason: mediaDisabledReason ?? (mediaBusy ? 'идёт генерация медиа' : undefined),
                onStart: style => void audioGen.start(brief, style),
                onCancel: audioGen.cancel,
                onForceAll: style => {
                  clearAudio();
                  void audioGen.start(brief, style);
                },
              }}
              run={{
                phase: calendarGen.phase,
                progress: calendarGen.progress,
                error: calendarGen.error,
                issues: calendarGen.issues,
                running,
                hasDraft: calendarGen.hasDraft,
                ownsRun: isCalendarRunActive(),
                estimate,
                onStop: requestStopCalendarRun,
                onContinueDraft: () => void calendarGen.run(brief),
                onDiscardDraft: () => calendarGen.discardDraft(),
              }}
            />
          </div>
        )}
      </div>

      <div
        className={styles.dockSlot}
        style={narrow || !dockOpen ? undefined : { height: dockHeight, maxHeight: '70vh' }}
      >
        {!narrow && dockOpen && (
          <PanelResizer
            axis="y"
            size={dockHeight}
            invert
            label="Высота дока"
            style={{ top: 0 }}
            onResize={(value: number) => setPanelSize('dock', value)}
            onReset={resetPanelSizes}
          />
        )}
        <Dock
          floating={narrow}
          running={running}
          assets={{
            brief,
            onGenerateBackgrounds: generateBackgrounds,
            onGenerateSprites: generateSprites,
            onForceSprites: forceSprites,
            busy: mediaBusy,
            disabledReason: mediaDisabledReason,
          }}
          prefabs={{ hasStory: Boolean(spine), readonly, onApplied: setNotice }}
          qa={{
            onRun: () => void qa.run(brief),
            running: qa.status.state === 'running',
            disabledReason: readonly
              ? READONLY_REASON
              : !spine
              ? 'истории ещё нет'
              : running
              ? 'идёт прогон'
              : undefined,
          }}
          summary={{
            prefabs: prefabLabel,
            assets: assetsSummary,
            qa:
              storyQA == null || storyQA.state === 'idle'
                ? 'проверка не запускалась'
                : `${qaErrors} ошибок · ${qaWarnings} предупреждений${qaErrors > 0 ? ' · экспорт заблокирован' : ''}`,
          }}
        />
      </div>

      <ModalHost
        exportGate={exportGate}
        onExportAnyway={exportBundle}
        onDiscardDraft={() => calendarGen.discardDraft()}
        onArchiveDraft={archiveDraft}
        onOpenQaReport={() => setDockTab('qa')}
        onNotify={setNotice}
        audioGen={{
          onGenerate: generateAudio,
          disabledReason: mediaDisabledReason ?? (mediaBusy ? 'идёт генерация медиа' : undefined),
        }}
        poseGen={{
          status: poseRegen.status,
          poseStatuses: poseRegen.poseStatuses,
          onStart: entries => {
            if (legacyOutline) void poseRegen.start(entries, brief, legacyOutline);
          },
          disabledReason: mediaDisabledReason ?? (mediaBusy ? 'идёт генерация медиа' : undefined),
        }}
      />

      <StatusBar
        mode={mode}
        items={statusItems}
        right={
          <>
            {running &&
              `web-lock: ${isCalendarRunActive() ? 'эта вкладка ведёт прогон' : 'прогон ведёт другая вкладка'} · `}
            seed <SeedPicker seed={brief.seed} disabled={readonly || running} up onChange={setSeed} />
          </>
        }
      />
    </div>
  );
};

export default Studio;
