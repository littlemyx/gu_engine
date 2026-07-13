import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  validateBrief,
  useBriefStore,
  useBulkImageGeneration,
  useBulkCharacterGeneration,
  useBulkAudioGeneration,
  buildBaseStyle,
  useNarrativeStore,
  useRegeneratePoses,
  CANONICAL_POSES,
  LOCATION_MOODS,
  LOCATION_MOOD_LABELS,
  DEFAULT_LOCATION_MOOD,
  isLocationMood,
  SPECIAL_AMBIENT_KINDS,
  SPECIAL_AMBIENT_KIND_LABELS,
  compileCalendarGameProject,
  downloadJson,
  slugify,
  type ArchetypeProfile,
  type LocationMood,
  type SpecialAmbientKind,
  type CharacterBulkStatus,
  type ImageBulkStatus,
  type AudioBulkStatus,
  type StoryAnchor,
  type StoryOutlinePlan,
  type PoseRegenEntry,
  type PoseRegenStatus,
  useStoryQA,
  type Brief,
  type Calendar,
  type CharacterSchedule,
  type SpinePlan,
  type SegmentIssue,
  type StoryQAStatus,
  type PolicyReport,
  type BulkCalendarRunOptions,
} from '@/narrative';
import { deriveCalendarMontage } from '@/narrative/calendarSliceModel';
import { deriveLegacyOutline } from '@/narrative/deriveLegacyOutline';
import { useBulkCalendarGeneration } from '@/narrative/useBulkCalendarGeneration';
import { OutlineGraph } from './OutlineGraph';
import { CharacterRelationshipPanel } from './CharacterRelationshipPanel';
import { AudioPreviewPanel } from './AudioPreviewPanel';
import { BriefEditor } from './BriefEditor';
import { PlaygroundErrorBoundary } from './PlaygroundErrorBoundary';
import { MontageBoard } from './MontageBoard';
import styles from './playground.module.css';

// ────────────────────────────────────────────────────────────────────────────
// APP SHELL (макет 4a): топ-бар с чипами пайплайна + левый рейл + секции
// ────────────────────────────────────────────────────────────────────────────

type SectionId = 'brief' | 'graph' | 'heroes' | 'audio' | 'export';
type GraphView = 'montage' | 'flow' | 'list';

const RAIL_ITEMS: { id: SectionId; label: string; round: boolean }[] = [
  { id: 'brief', label: 'Бриф', round: false },
  { id: 'graph', label: 'Граф', round: true },
  { id: 'heroes', label: 'Герои', round: false },
  { id: 'audio', label: 'Аудио', round: true },
  { id: 'export', label: 'Экспорт', round: false },
];

const CHIP_DONE = '#16a34a';
const CHIP_PARTIAL = '#f59e0b';
const CHIP_RUNNING = '#4f46e5';
const CHIP_IDLE = '#d1d5db';

type ChipSpec = { key: string; label: string; dot: string; target: SectionId };

const progressChip = (
  key: string,
  name: string,
  done: number,
  total: number,
  running: boolean,
  target: SectionId,
): ChipSpec => ({
  key,
  target,
  label: total > 0 && done >= total ? `${name} ✓` : `${name} ${done}/${total}`,
  dot: running ? CHIP_RUNNING : total > 0 && done >= total ? CHIP_DONE : done > 0 ? CHIP_PARTIAL : CHIP_IDLE,
});

const Playground = () => {
  const brief = useBriefStore(s => s.brief);
  const issues = useMemo(() => validateBrief(brief), [brief]);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const imageGen = useBulkImageGeneration();
  const characterGen = useBulkCharacterGeneration();
  const poseRegen = useRegeneratePoses();
  const audioGen = useBulkAudioGeneration();
  const calendarGen = useBulkCalendarGeneration();
  const storyQA = useStoryQA();

  const isBlocked = errorCount > 0;

  const [activeSection, setActiveSection] = useState<SectionId>(() =>
    useNarrativeStore.getState().spine ? 'graph' : 'brief',
  );
  const [graphView, setGraphView] = useState<GraphView>('montage');

  // Статусы пайплайна для чипов топ-бара.
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioByLi = useNarrativeStore(s => s.audioByLi);

  // Календарная монтажка: модель деривируется, когда весь стек стадий готов.
  const calendar = useNarrativeStore(s => s.calendar);
  const spine = useNarrativeStore(s => s.spine);
  const schedule = useNarrativeStore(s => s.schedule);
  const spineBeatProse = useNarrativeStore(s => s.spineBeatProse);
  // Селектор веток монтажки: branchPointId → outcomeId (нет ключа = все ветки).
  const [branchAssignment, setBranchAssignment] = useState<Record<string, string>>({});
  const calendarModel = useMemo(
    () =>
      calendar && spine && schedule
        ? deriveCalendarMontage({ brief, calendar, spine, schedule, worldModel, spineBeatProse, branchAssignment })
        : null,
    [brief, calendar, spine, schedule, worldModel, spineBeatProse, branchAssignment],
  );

  // Адаптер совместимости: страницы героев/фонов и промпт-билдеры живут на
  // StoryOutlinePlan — хребет+календарь дают производный outline.
  const derivedLegacy = useMemo(
    () => (spine && calendar ? deriveLegacyOutline(spine, calendar, schedule, brief, worldModel) : null),
    [spine, calendar, schedule, brief, worldModel],
  );
  const activeOutline = derivedLegacy?.outline ?? null;

  const calendarRunning = calendarGen.phase !== 'idle' && calendarGen.phase !== 'done' && !calendarGen.error;
  const chips = useMemo<ChipSpec[]>(() => {
    const anchorCount = activeOutline?.anchors.length ?? 0;
    const liCount = brief.loveInterests.length;
    const beatsDone = Object.keys(spineBeatProse).length;
    const imagesDone = Object.entries(images).filter(([k, i]) => i.status === 'done' && k.startsWith('loc:')).length;
    const imagesTotal = worldModel ? worldModel.locations.length : 0;
    const charsDone = Object.values(characters).filter(c => c.status === 'done').length;
    const audioDone =
      (audioBase?.status === 'done' ? 1 : 0) +
      Object.values(audioByLi).reduce(
        (acc, li) => acc + (li.positive?.status === 'done' ? 1 : 0) + (li.negative?.status === 'done' ? 1 : 0),
        0,
      );
    return [
      {
        key: 'spine',
        target: 'graph',
        label: spine ? 'Хребет ✓' : 'Хребет —',
        dot: calendarRunning ? CHIP_RUNNING : spine ? CHIP_DONE : CHIP_IDLE,
      },
      progressChip('scenes', 'Сцены', beatsDone, anchorCount, calendarGen.phase === 'beat_prose', 'graph'),
      progressChip('images', 'Фоны', imagesDone, imagesTotal, imageGen.status.state === 'running', 'graph'),
      progressChip('sprites', 'Спрайты', charsDone, liCount, characterGen.status.state === 'running', 'heroes'),
      progressChip('audio', 'Аудио', audioDone, 1 + liCount * 2, audioGen.status.state === 'running', 'audio'),
    ];
  }, [
    activeOutline,
    brief.loveInterests.length,
    spine,
    spineBeatProse,
    images,
    characters,
    worldModel,
    audioBase,
    audioByLi,
    calendarRunning,
    calendarGen.phase,
    imageGen.status.state,
    characterGen.status.state,
    audioGen.status.state,
  ]);

  return (
    <div className={styles.shell}>
      <div className={styles.topBar}>
        <span className={styles.topTitle}>{activeOutline?.title || 'Procedural Narrative Pilot'}</span>
        <span className={styles.topMeta}>
          {brief.genre}
          {activeOutline && ` · ${activeOutline.acts.length} акта · ${activeOutline.anchors.length} срезов`}
        </span>
        <div className={styles.topChips}>
          {chips.map(chip => (
            <button
              key={chip.key}
              type="button"
              className={styles.pipeChip}
              onClick={() => setActiveSection(chip.target)}
            >
              <span className={styles.pipeDot} style={{ background: chip.dot }} />
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            className={styles.primaryBtn}
            style={{ marginLeft: 8 }}
            onClick={() => setActiveSection('export')}
          >
            Экспорт
          </button>
        </div>
      </div>

      <div className={styles.shellBody}>
        <nav className={styles.rail}>
          {RAIL_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`${styles.railItem} ${activeSection === item.id ? styles.railItemActive : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className={`${styles.railIcon} ${item.round ? styles.railIconRound : ''}`} />
              <span className={styles.railLabel}>{item.label}</span>
            </button>
          ))}
          <span className={styles.railSpacer} />
          <Link className={styles.railHome} to="/" title="canvas редактор сцен">
            ↩ canvas
          </Link>
        </nav>

        {activeSection === 'brief' && <BriefSection brief={brief} issues={issues} />}

        {activeSection === 'graph' && (
          <div className={styles.sectionScroll}>
            <CalendarGenBar gen={calendarGen} brief={brief} hasSpine={Boolean(spine)} disabled={isBlocked} />
            {activeOutline ? (
              <PlaygroundErrorBoundary>
                <div className={styles.graphInner}>
                  <div className={styles.viewToggle}>
                    {(
                      [
                        ['montage', 'Монтажный стол'],
                        ['flow', 'Граф якорей'],
                        ['list', 'Список якорей'],
                      ] as [GraphView, string][]
                    ).map(([view, label]) => (
                      <button
                        key={view}
                        type="button"
                        className={`${styles.viewToggleBtn} ${graphView === view ? styles.viewToggleActive : ''}`}
                        onClick={() => setGraphView(view)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {graphView === 'montage' &&
                    (calendarModel ? (
                      <MontageBoard
                        calendarModel={calendarModel}
                        branchAssignment={branchAssignment}
                        onBranchAssignmentChange={setBranchAssignment}
                      />
                    ) : (
                      <div className={styles.graphEmpty}>
                        <span>Монтажный стол появится после генерации расписания (бар выше).</span>
                      </div>
                    ))}
                </div>
                {graphView === 'flow' && <OutlineGraph outline={activeOutline} />}
                {graphView === 'list' && <OutlineResult outline={activeOutline} />}
                <ImageGenBar
                  status={imageGen.status}
                  onStart={() => imageGen.start(brief, activeOutline)}
                  onCancel={imageGen.cancel}
                  onReset={imageGen.reset}
                  anchorCount={activeOutline.anchors.length}
                />
              </PlaygroundErrorBoundary>
            ) : (
              <div className={styles.graphEmpty}>
                <span>
                  Монтажный стол строится по календарю+хребту (бар выше) или по легаси story outline из брифа.
                </span>
                <button type="button" className={styles.primaryBtn} onClick={() => setActiveSection('brief')}>
                  Перейти к брифу
                </button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'heroes' && (
          <div className={styles.sectionScroll}>
            {activeOutline ? (
              <PlaygroundErrorBoundary>
                <div className={styles.sectionPad}>
                  <CharacterRelationshipPanel outline={activeOutline} />
                </div>
                <CharacterGenBar
                  status={characterGen.status}
                  onStart={() => characterGen.start(brief, activeOutline)}
                  onForceStart={() => characterGen.start(brief, activeOutline, { force: true })}
                  onCancel={characterGen.cancel}
                  onReset={characterGen.reset}
                  onRegenMissing={entries => poseRegen.start(entries, brief, activeOutline)}
                  liCount={brief.loveInterests.length}
                />
                <MissingPosesBar
                  regenStatus={poseRegen.status}
                  onStart={entries => poseRegen.start(entries, brief, activeOutline)}
                  onReset={poseRegen.reset}
                />
              </PlaygroundErrorBoundary>
            ) : (
              <div className={styles.graphEmpty}>
                <span>Линии героев появятся после генерации story outline.</span>
                <button type="button" className={styles.primaryBtn} onClick={() => setActiveSection('brief')}>
                  Перейти к брифу
                </button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'audio' && (
          <div className={styles.sectionScroll}>
            <PlaygroundErrorBoundary>
              <div className={styles.sectionPad}>
                <LocationMoodPanel />
              </div>
              <AudioGenBar
                status={audioGen.status}
                brief={brief}
                onStart={style => audioGen.start(brief, style)}
                onCancel={audioGen.cancel}
                onReset={audioGen.reset}
              />
              <AudioPreviewPanel />
            </PlaygroundErrorBoundary>
          </div>
        )}

        {activeSection === 'export' && (
          <div className={styles.sectionScroll}>
            {activeOutline ? (
              <PlaygroundErrorBoundary>
                <QAPanel
                  qa={storyQA}
                  brief={brief}
                  hasCalendarStack={Boolean(spine && calendar && schedule)}
                  onRegenerateWithFeedback={options => void calendarGen.run(brief, options)}
                  regenRunning={calendarGen.phase !== 'idle' && calendarGen.phase !== 'done' && !calendarGen.error}
                />
                <ExportBar
                  outline={activeOutline}
                  spine={spine}
                  calendar={calendar}
                  schedule={schedule}
                  qaStatus={storyQA.status}
                />
              </PlaygroundErrorBoundary>
            ) : (
              <div className={styles.graphEmpty}>
                <span>Экспортировать пока нечего — нужен story outline.</span>
                <button type="button" className={styles.primaryBtn} onClick={() => setActiveSection('brief')}>
                  Перейти к брифу
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// СЕКЦИЯ «БРИФ» (бриф + валидация + архетипы)
// ────────────────────────────────────────────────────────────────────────────

const BriefSection: React.FC<{
  brief: Brief;
  issues: ReturnType<typeof validateBrief>;
}> = ({ brief, issues }) => {
  const [showRawBrief, setShowRawBrief] = useState(false);

  return (
    <div className={styles.sectionScroll}>
      <div className={styles.body}>
        <div className={styles.column}>
          <BriefEditor brief={brief} />
          <BriefIssues issues={issues} />

          <section className={styles.section}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 12,
              }}
            >
              <h2 className={styles.sectionTitle}>
                Полный бриф (JSON) <span className={styles.sectionMeta}>контракт для outline-генератора</span>
              </h2>
              <button type="button" className={styles.toggleBtn} onClick={() => setShowRawBrief(v => !v)}>
                {showRawBrief ? 'Свернуть' : 'Раскрыть'}
              </button>
            </div>
            {showRawBrief && <pre className={styles.jsonBlock}>{JSON.stringify(brief, null, 2)}</pre>}
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Библиотека архетипов{' '}
              <span className={styles.sectionMeta}>{ARCHETYPE_IDS.length} профиля для romance_vn</span>
            </h2>
            {ARCHETYPE_IDS.map(id => (
              <ArchetypeView key={id} archetype={ARCHETYPES[id]} />
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

const BriefIssues: React.FC<{
  issues: ReturnType<typeof validateBrief>;
}> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Валидация</h2>
        <div className={styles.issueNone}>Структурных проблем не найдено.</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Валидация <span className={styles.sectionMeta}>{issues.length} замечаний</span>
      </h2>
      {issues.map((issue, idx) => (
        <div key={idx} className={issue.severity === 'error' ? styles.issueError : styles.issueWarning}>
          <span className={styles.issuePath}>{issue.path}</span>
          {issue.message}
        </div>
      ))}
    </section>
  );
};

const ArchetypeView: React.FC<{ archetype: ArchetypeProfile }> = ({ archetype }) => {
  return (
    <div className={styles.archetypeCard}>
      <div className={styles.archetypeHeader}>
        <span className={styles.archetypeId}>{archetype.id}</span>
        <span className={styles.archetypeShape}>{archetype.trajectory.shape}</span>
      </div>
      <p className={styles.archetypeDesc}>{archetype.description}</p>

      <div className={styles.kvList}>
        <span className={styles.kvKey}>obstacle</span>
        <span className={styles.kvVal}>
          {archetype.obstacleType} · {archetype.obstacleThemes.join(', ')}
        </span>
        <span className={styles.kvKey}>initial</span>
        <span className={styles.kvVal}>
          {Object.entries(archetype.initialState)
            .map(([k, range]) => `${k} ${range?.[0]}–${range?.[1]}`)
            .join(', ')}
        </span>
        {archetype.additionalStateVars && (
          <>
            <span className={styles.kvKey}>+vars</span>
            <span className={styles.kvVal}>{Object.keys(archetype.additionalStateVars).join(', ')}</span>
          </>
        )}
      </div>

      <div className={styles.beatsLabel}>required beats</div>
      {archetype.requiredBeats.map((beat, idx) => (
        <div key={idx} className={styles.beatItem}>
          <span className={styles.beatType}>{beat.type}</span>
          <span className={styles.beatPos}>@ {beat.position}</span>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{beat.purpose}</div>
        </div>
      ))}

      <div className={styles.beatsLabel}>endings</div>
      {(['good', 'normal', 'bad'] as const).map(kind => {
        const profile = archetype.endingProfile[kind];
        return (
          <div key={kind} className={styles.endingRow}>
            <span>
              <span className={styles.beatType}>{kind}</span>{' '}
              <span style={{ color: '#9ca3af' }}>×{profile.weight}</span>
            </span>
            <span className={styles.endingTone}>{profile.tone}</span>
          </div>
        );
      })}

      {archetype.archetypeSpecificsSchema && (
        <>
          <div className={styles.beatsLabel}>обязательные archetype_specifics</div>
          {Object.entries(archetype.archetypeSpecificsSchema).map(([field, decl]) => (
            <div key={field} className={styles.beatItem}>
              <span className={styles.beatType}>{field}</span>
              {decl.required && <span className={styles.beatPos}>required</span>}
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>напр.: {decl.examples.join(', ')}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// OUTLINE (производный от хребта — вид «Список якорей»)
// ────────────────────────────────────────────────────────────────────────────

const OutlineResult: React.FC<{ outline: StoryOutlinePlan }> = ({ outline }) => {
  const byAct = useMemo(() => {
    const map = new Map<number, StoryAnchor[]>();
    for (const a of outline.anchors) {
      const list = map.get(a.act) ?? [];
      list.push(a);
      map.set(a.act, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [outline.anchors]);

  return (
    <div className={styles.outlineResult}>
      <div className={styles.outlineHeader}>
        <h2 className={styles.outlineTitle}>{outline.title || 'Без названия'}</h2>
        {outline.logline && <p className={styles.outlineLogline}>{outline.logline}</p>}
      </div>

      <div className={styles.actsRow}>
        {outline.acts.map(a => (
          <div key={a.act} className={styles.actCard}>
            <div className={styles.actLabel}>акт {a.act}</div>
            <div className={styles.actPurpose}>{a.purpose}</div>
            {a.tone && <div className={styles.actTone}>{a.tone}</div>}
          </div>
        ))}
      </div>

      {byAct.map(([act, anchors]) => (
        <div key={act} className={styles.routeBlock}>
          <div className={styles.routeTitle}>
            <span className={styles.routeTitleLi}>акт {act}</span>
            <span style={{ color: '#9ca3af', fontSize: 11 }}>{anchors.length} якорей</span>
          </div>
          {anchors.map(anchor => (
            <AnchorRow key={anchor.id} anchor={anchor} />
          ))}
        </div>
      ))}
    </div>
  );
};

const AnchorRow: React.FC<{ anchor: StoryAnchor }> = ({ anchor }) => {
  return (
    <div className={styles.anchorRow}>
      <div className={styles.anchorIdCell}>
        <span className={styles.anchorIdName}>{anchor.id}</span>
        <span className={styles.anchorTypeTag}>
          {anchor.type} · акт {anchor.act}
          {anchor.location ? ` · ${anchor.location}` : ''}
        </span>
      </div>
      <div className={styles.anchorBodyCell}>
        <span>{anchor.summary}</span>
        {anchor.timeMarker && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{anchor.timeMarker}</div>}
        {anchor.availableLIs.length > 0 && (
          <div className={styles.anchorEstablishes}>
            {anchor.availableLIs.map(li => (
              <span key={li} className={styles.anchorEstablish}>
                {li}
              </span>
            ))}
          </div>
        )}
        {anchor.establishes.length > 0 && (
          <div className={styles.anchorEstablishes}>
            {anchor.establishes.map(f => (
              <span key={f} className={styles.anchorEstablish}>
                +{f}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// CALENDAR GENERATION (календарный пайплайн)
// ────────────────────────────────────────────────────────────────────────────

const CALENDAR_PHASE_LABEL: Record<string, string> = {
  cast: 'Каст и агенды',
  world_calendar: 'Мир и календарь',
  spine: 'Хребет истории',
  schedule: 'Расписание персонажей',
  beat_prose: 'Проза битов',
  event_pool: 'Пул событий',
  prune: 'Отсев недостижимого',
  dialogue_units: 'Диалоговые юниты',
  ending_prose: 'Проза концовок',
};

/** Бар календарного пайплайна: cast → мир+календарь → хребет → расписание → проза битов → пул событий → pruning → проза юнитов. */
const CalendarGenBar: React.FC<{
  gen: ReturnType<typeof useBulkCalendarGeneration>;
  brief: Brief;
  hasSpine: boolean;
  disabled: boolean;
}> = ({ gen, brief, hasSpine, disabled }) => {
  const running = gen.phase !== 'idle' && gen.phase !== 'done' && !gen.error;
  const pct = gen.progress.total === 0 ? 0 : Math.round((gen.progress.completed / gen.progress.total) * 100);
  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkLeft}>
        <span className={styles.bulkTitle}>
          Календарь + хребет (v1)
          {running && ` · ${CALENDAR_PHASE_LABEL[gen.phase] ?? gen.phase}`}
          {gen.phase === 'done' && ' · готово ✓'}
        </span>
        {running && (
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        )}
        <span className={styles.bulkMeta}>
          {gen.error ? (
            <>
              ✗ {gen.error}
              {gen.issues.length > 0 && ` · ${gen.issues.slice(0, 2).join('; ')}`}
            </>
          ) : (
            'время как ось: слоты (день × часть дня), биты с окнами, расписание LI по локациям'
          )}
        </span>
      </div>
      <button
        type="button"
        className={hasSpine ? styles.secondaryBtn : styles.primaryBtn}
        onClick={() => void gen.run(brief)}
        disabled={disabled || running}
      >
        {running ? 'Генерация...' : hasSpine ? 'Перегенерировать' : 'Сгенерировать'}
      </button>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// IMAGE GENERATION (фоны для каждого якоря через image_gen)
// ────────────────────────────────────────────────────────────────────────────

const ImageGenBar: React.FC<{
  status: ImageBulkStatus;
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
  anchorCount: number;
}> = ({ status, onStart, onCancel, onReset, anchorCount }) => {
  const images = useNarrativeStore(s => s.images);
  const cachedDone = Object.values(images).filter(i => i.status === 'done').length;

  if (status.state === 'idle') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Генерация фонов · {cachedDone} / {anchorCount} готово
          </span>
          <span className={styles.bulkMeta}>
            один POST /generate/background на якорь · 3 параллельно · ~3–5 минут на полный outline
          </span>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={onStart}>
          Сгенерировать фоны
        </button>
      </div>
    );
  }

  if (status.state === 'running') {
    const pct = status.total === 0 ? 100 : Math.round((status.completed / status.total) * 100);
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Image-генерация · {status.completed} / {status.total}
            {status.cancelled && ' (отменяется...)'}
          </span>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.bulkMeta}>
            ⚙ в процессе: {status.inFlight} · ⌛ в очереди: {status.remaining}
            {status.failures.length > 0 && ` · ✗ ошибок: ${status.failures.length}`}
          </span>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={status.cancelled}>
          {status.cancelled ? 'Отменяется...' : 'Остановить'}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkLeft}>
        <span className={styles.bulkTitle}>
          Image-генерация завершена · {status.completed} / {status.total}
          {status.cancelled && ' (остановлено)'}
        </span>
        <span className={styles.bulkMeta}>
          {status.failures.length > 0 ? (
            <>
              ✗ {status.failures.length} ошибок:{' '}
              {status.failures
                .slice(0, 3)
                .map(f => f.anchorId)
                .join(', ')}
              {status.failures.length > 3 && ` и ещё ${status.failures.length - 3}`}
            </>
          ) : (
            'все фоны сгенерированы успешно'
          )}
        </span>
      </div>
      <button type="button" className={styles.secondaryBtn} onClick={onReset}>
        OK
      </button>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// CHARACTER GENERATION (idle-спрайты для каждого LI через image_gen)
// ────────────────────────────────────────────────────────────────────────────

const CharacterGenBar: React.FC<{
  status: CharacterBulkStatus;
  onStart: () => void;
  onForceStart: () => void;
  onCancel: () => void;
  onReset: () => void;
  onRegenMissing: (entries: PoseRegenEntry[]) => void;
  liCount: number;
}> = ({ status, onStart, onForceStart, onCancel, onReset, onRegenMissing, liCount }) => {
  const characters = useNarrativeStore(s => s.characters);
  const cachedDone = Object.values(characters).filter(c => c.status === 'done').length;
  const allDone = liCount > 0 && cachedDone >= liCount;

  const missingEntries = useMemo(() => {
    if (!allDone) return [];
    const entries: PoseRegenEntry[] = [];
    for (const [liId, state] of Object.entries(characters)) {
      if (state.status !== 'done') continue;
      for (const pose of CANONICAL_POSES) {
        if (pose === 'idle') continue;
        if (!state.poseFilenames?.[pose]) entries.push({ liId, pose });
      }
    }
    return entries;
  }, [characters, allDone]);

  if (status.state === 'idle') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Генерация спрайтов персонажей · {cachedDone} / {liCount} готово
          </span>
          <span className={styles.bulkMeta}>
            {missingEntries.length > 0 && `${missingEntries.length} поз не хватает`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {allDone && missingEntries.length > 0 && (
            <button type="button" className={styles.primaryBtn} onClick={() => onRegenMissing(missingEntries)}>
              Догенерировать ({missingEntries.length})
            </button>
          )}
          {allDone ? (
            <button type="button" className={styles.secondaryBtn} onClick={onForceStart}>
              Перегенерировать всё
            </button>
          ) : (
            <button type="button" className={styles.primaryBtn} onClick={onStart} disabled={liCount === 0}>
              Сгенерировать спрайты
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status.state === 'running') {
    const pct = status.total === 0 ? 100 : Math.round((status.completed / status.total) * 100);
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Character-генерация · {status.completed} / {status.total}
            {status.cancelled && ' (отменяется...)'}
          </span>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.bulkMeta}>
            ⚙ в процессе: {status.inFlight} · ⌛ в очереди: {status.remaining}
            {status.failures.length > 0 && ` · ✗ ошибок: ${status.failures.length}`}
          </span>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={status.cancelled}>
          {status.cancelled ? 'Отменяется...' : 'Остановить'}
        </button>
      </div>
    );
  }

  const firstError = status.failures[0];
  const isServiceError = firstError?.liId === '__service__';
  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkLeft}>
        <span className={styles.bulkTitle}>
          Character-генерация завершена · {status.completed} / {status.total}
          {status.cancelled && ' (остановлено)'}
        </span>
        <span className={styles.bulkMeta} style={isServiceError ? { color: '#dc2626' } : undefined}>
          {firstError ? (
            isServiceError ? (
              <>✗ {firstError.error}</>
            ) : (
              <>
                ✗ {status.failures.length} ошибок · {firstError.error}
              </>
            )
          ) : (
            'все спрайты сгенерированы успешно'
          )}
        </span>
      </div>
      <button type="button" className={styles.secondaryBtn} onClick={onReset}>
        OK
      </button>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// MISSING POSES BAR (detect unmapped emotions, offer regeneration)
// ────────────────────────────────────────────────────────────────────────────

const MissingPosesBar: React.FC<{
  regenStatus: PoseRegenStatus;
  onStart: (entries: PoseRegenEntry[]) => void;
  onReset: () => void;
}> = ({ regenStatus, onStart, onReset }) => {
  const characters = useNarrativeStore(s => s.characters);
  const [expanded, setExpanded] = useState(false);

  const missingData = useMemo(() => {
    const hasCharacters = Object.values(characters).some(c => c.status === 'done');
    if (!hasCharacters) return null;

    const missing = new Map<string, string[]>();
    for (const [liId, state] of Object.entries(characters)) {
      if (state.status !== 'done') continue;
      const missingPoses: string[] = [];
      for (const pose of CANONICAL_POSES) {
        if (pose === 'idle') continue;
        if (!state.poseFilenames?.[pose]) missingPoses.push(pose);
      }
      if (missingPoses.length > 0) missing.set(liId, missingPoses);
    }
    if (missing.size === 0) return null;

    const entries: PoseRegenEntry[] = [];
    for (const [liId, poses] of missing) {
      for (const pose of poses) entries.push({ liId, pose });
    }
    return { missing, entries, totalPoses: entries.length, totalChars: missing.size };
  }, [characters]);

  if (!missingData && regenStatus.state === 'idle') return null;

  if (regenStatus.state === 'running') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Догенерация поз · {regenStatus.completed} / {regenStatus.total}
          </span>
          <span className={styles.bulkMeta}>{regenStatus.current}</span>
        </div>
      </div>
    );
  }

  if (regenStatus.state === 'done') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Догенерация завершена · {regenStatus.completed} / {regenStatus.total}
          </span>
          <span className={styles.bulkMeta}>
            {regenStatus.failed.length > 0 ? `✗ ${regenStatus.failed.length} не удалось` : 'все позы сгенерированы'}
          </span>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onReset}>
          OK
        </button>
      </div>
    );
  }

  if (!missingData) return null;

  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkLeft}>
        <span className={styles.bulkTitle}>
          {missingData.totalPoses} отсутств. поз у {missingData.totalChars} перс.
        </span>
        <span
          className={styles.bulkMeta}
          style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'свернуть' : 'подробнее'}
        </span>
        {expanded && (
          <span className={styles.bulkMeta}>
            {[...missingData.missing.entries()].map(([id, poses]) => `${id}: ${poses.join(', ')}`).join(' · ')}
          </span>
        )}
      </div>
      <button type="button" className={styles.primaryBtn} onClick={() => onStart(missingData.entries)}>
        Догенерировать
      </button>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// EXPORT BAR (.gu.json + scenes.json для game/-движка)
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// AUDIO GENERATION (базовая мелодия + вариации per-LI + SFX через audio_gen)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Редактор настроения локаций. LLM проставляет mood/специальный тип при генерации
 * модели мира; здесь автор может переопределить перед генерацией аудио — от них
 * зависит, какой эмбиент-бед играет на локации. Особый тип (бар/стадион) имеет
 * приоритет над настроением. Скрыт без модели мира.
 */
const LocationMoodPanel: React.FC = () => {
  const worldModel = useNarrativeStore(s => s.worldModel);
  const patchLocation = useNarrativeStore(s => s.patchLocation);
  if (!worldModel || worldModel.locations.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Настроение локаций{' '}
        <span className={styles.sectionMeta}>
          настроение → эмбиент-бед; особый тип (бар/стадион) в приоритете. Задайте до генерации аудио
        </span>
      </h2>
      <div className={styles.moodGrid}>
        {worldModel.locations.map(loc => (
          <div key={loc.id} className={styles.moodRow}>
            <span className={styles.moodLocName}>{loc.name || loc.id}</span>
            <div className={styles.moodSelects}>
              <select
                className={styles.moodSelect}
                value={isLocationMood(loc.mood) ? loc.mood : DEFAULT_LOCATION_MOOD}
                onChange={e => patchLocation(loc.id, { mood: e.target.value as LocationMood })}
                title="Настроение → эмбиент-бед"
              >
                {LOCATION_MOODS.map(m => (
                  <option key={m} value={m}>
                    {LOCATION_MOOD_LABELS[m]}
                  </option>
                ))}
              </select>
              <select
                className={styles.moodSelect}
                value={loc.specialKind ?? ''}
                onChange={e =>
                  patchLocation(loc.id, {
                    specialKind: e.target.value ? (e.target.value as SpecialAmbientKind) : null,
                  })
                }
                title="Особый диегетический эмбиент (приоритет над настроением)"
              >
                <option value="">— обычная —</option>
                {SPECIAL_AMBIENT_KINDS.map(k => (
                  <option key={k} value={k}>
                    {SPECIAL_AMBIENT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const AudioGenBar: React.FC<{
  status: AudioBulkStatus;
  brief: Brief;
  onStart: (baseStyle: string) => void;
  onCancel: () => void;
  onReset: () => void;
}> = ({ status, brief, onStart, onCancel, onReset }) => {
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioByLi = useNarrativeStore(s => s.audioByLi);
  const audioSfx = useNarrativeStore(s => s.audioSfx);
  const [baseStyle, setBaseStyle] = useState(() => buildBaseStyle(brief));

  const liCount = brief.loveInterests.length;
  const variationsDone = Object.values(audioByLi).reduce(
    (acc, li) => acc + (li.positive?.status === 'done' ? 1 : 0) + (li.negative?.status === 'done' ? 1 : 0),
    0,
  );
  const sfxDone = Object.keys(audioSfx).length;
  const baseDone = audioBase?.status === 'done';

  const phaseLabel: Record<string, string> = {
    base: 'базовая подложка',
    beds: 'эмбиенты по настроению',
    variations: 'вариации персонажей',
    sfx: 'SFX',
  };

  if (status.state === 'running') {
    const pct = status.total === 0 ? 100 : Math.round((status.completed / status.total) * 100);
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Аудио-генерация · {phaseLabel[status.phase]} · {status.completed} / {status.total}
            {status.cancelled && ' (отменяется...)'}
          </span>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.bulkMeta}>
            Suno-задачи идут минуты каждая
            {status.failures.length > 0 && ` · ✗ ошибок: ${status.failures.length}`}
          </span>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={status.cancelled}>
          {status.cancelled ? 'Отменяется...' : 'Остановить'}
        </button>
      </div>
    );
  }

  if (status.state === 'done') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Аудио-генерация завершена · {status.completed} / {status.total}
            {status.cancelled && ' (остановлено)'}
          </span>
          <span className={styles.bulkMeta}>
            {status.failures.length > 0
              ? `✗ ${status.failures.length} ошибок: ${status.failures
                  .slice(0, 3)
                  .map(f => f.key)
                  .join(', ')}${status.failures.length > 3 ? ` и ещё ${status.failures.length - 3}` : ''}`
              : 'база, вариации и SFX готовы'}
          </span>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onReset}>
          OK
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkLeft}>
        <span className={styles.bulkTitle}>
          Генерация аудио · база: {baseDone ? '✓' : '—'} · вариации: {variationsDone}/{liCount * 2} · SFX: {sfxDone}/7
        </span>
        <span className={styles.bulkMeta}>
          Suno API · мелодия → per-LI вариации (positive/negative) → SFX по эмоциям · нужен audio_gen (:3300) c
          SUNO_API_KEY и S3-кредами
        </span>
        <textarea
          className={styles.audioStyleInput}
          value={baseStyle}
          onChange={e => setBaseStyle(e.target.value)}
          rows={2}
          placeholder="Стиль базовой мелодии"
        />
      </div>
      <button type="button" className={styles.primaryBtn} onClick={() => onStart(baseStyle)}>
        Сгенерировать аудио
      </button>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// STORY QA PANEL (D2 структурный + D3 симуляция + D4 критик листьев)
// ────────────────────────────────────────────────────────────────────────────

/** Порядок групп в отчёте; неизвестные префиксы уходят в конец. */
const QA_GROUP_ORDER = ['spine', 'calendar', 'schedule', 'units', 'dialogue', 'qa', 'sim', 'leaf'];

const qaGroupOf = (issue: SegmentIssue): string => issue.scope.split('/')[0] || '?';

/** Затравки регенерации: spine-issues списком, dialogue-issues по unitId. */
function buildSeedIssues(issues: SegmentIssue[]): BulkCalendarRunOptions['seedIssues'] {
  const spine = issues.filter(i => qaGroupOf(i) === 'spine').map(i => `[${i.severity}] ${i.scope}: ${i.message}`);
  const dialogue: Record<string, string[]> = {};
  for (const i of issues) {
    if (qaGroupOf(i) !== 'dialogue') continue;
    const unitId = i.scope.split('/')[1];
    if (!unitId) continue;
    (dialogue[unitId] ??= []).push(`[${i.severity}] ${i.scope}: ${i.message}`);
  }
  const seeds: NonNullable<BulkCalendarRunOptions['seedIssues']> = {};
  if (spine.length > 0) seeds.spine = spine;
  if (Object.keys(dialogue).length > 0) seeds.dialogue = dialogue;
  return Object.keys(seeds).length > 0 ? seeds : undefined;
}

const PolicyTable: React.FC<{ reports: PolicyReport[] }> = ({ reports }) => {
  if (reports.length === 0) return null;
  return (
    <table className={styles.qaPolicyTable}>
      <thead>
        <tr>
          <th>политика</th>
          <th>финал</th>
          <th>концовка</th>
          <th>мёртвые слоты</th>
        </tr>
      </thead>
      <tbody>
        {reports.map(r => (
          <tr key={r.policy}>
            <td className={styles.qaPolicyName}>{r.policy}</td>
            <td>{r.reachedFinale ? '✓' : '✗'}</td>
            <td>{r.endingSatisfied ?? '—'}</td>
            <td>
              {r.deadSlots.length} / {r.slotCount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const QAPanel: React.FC<{
  qa: ReturnType<typeof useStoryQA>;
  brief: Brief;
  hasCalendarStack: boolean;
  onRegenerateWithFeedback: (options: BulkCalendarRunOptions) => void;
  regenRunning: boolean;
}> = ({ qa, brief, hasCalendarStack, onRegenerateWithFeedback, regenRunning }) => {
  const { state, issues, policyReports } = qa.status;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.length - errorCount;

  const groups = useMemo(() => {
    const map = new Map<string, SegmentIssue[]>();
    for (const i of issues) {
      const g = qaGroupOf(i);
      (map.get(g) ?? map.set(g, []).get(g)!).push(i);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ia = QA_GROUP_ORDER.indexOf(a);
      const ib = QA_GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || (a < b ? -1 : 1);
    });
  }, [issues]);

  const seedIssues = useMemo(() => (state === 'done' ? buildSeedIssues(issues) : undefined), [state, issues]);

  return (
    <div className={styles.qaPanel}>
      <div className={styles.qaHeader}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Story QA
            {state === 'running' && ' · проверяется...'}
            {state === 'done' &&
              (issues.length === 0 ? ' · чисто ✓' : ` · ✗ ${errorCount} ошибок · ⚠ ${warningCount} предупреждений`)}
          </span>
          <span className={styles.bulkMeta}>
            структурный отчёт + симуляция политик по evaluateSlice + LLM-критик листьев (text_gen)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {state === 'done' && seedIssues && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onRegenerateWithFeedback({ seedIssues })}
              disabled={regenRunning}
              title="issues групп spine/dialogue уходят previousIssues-фидбеком соответствующих стадий"
            >
              {regenRunning ? 'Регенерация...' : 'Перегенерировать с фидбеком'}
            </button>
          )}
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void qa.run(brief)}
            disabled={state === 'running' || !hasCalendarStack}
            title={hasCalendarStack ? undefined : 'нужен календарный стек (calendar + spine + schedule)'}
          >
            {state === 'running' ? 'Проверка...' : 'Проверить историю'}
          </button>
        </div>
      </div>

      {state === 'done' && <PolicyTable reports={policyReports} />}

      {state === 'done' &&
        groups.map(([group, groupIssues]) => (
          <div key={group} className={styles.qaGroup}>
            <div className={styles.qaGroupTitle}>
              <span className={styles.issuePath}>{group}/</span>
              <span className={styles.qaBadgeError}>{groupIssues.filter(i => i.severity === 'error').length} err</span>
              <span className={styles.qaBadgeWarning}>
                {groupIssues.filter(i => i.severity === 'warning').length} warn
              </span>
            </div>
            {groupIssues.map((issue, idx) => (
              <div key={idx} className={issue.severity === 'error' ? styles.issueError : styles.issueWarning}>
                <span className={styles.issuePath}>{issue.scope}</span>
                {issue.message}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
};

const ExportBar: React.FC<{
  outline: StoryOutlinePlan;
  /** Полный календарный стек → компиляция через compileCalendarGameProject. */
  spine?: SpinePlan | null;
  calendar?: Calendar | null;
  schedule?: CharacterSchedule | null;
  /** Последний прогон story QA — гейт экспорта при error-severity issues. */
  qaStatus?: StoryQAStatus;
}> = ({ outline, spine, calendar, schedule, qaStatus }) => {
  const brief = useBriefStore(s => s.brief);
  const endings = useNarrativeStore(s => s.endings);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const spineBeatProse = useNarrativeStore(s => s.spineBeatProse);
  const unitProse = useNarrativeStore(s => s.unitProse);
  const eventUnits = useNarrativeStore(s => s.eventUnits);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioMoodBeds = useNarrativeStore(s => s.audioMoodBeds);
  const audioSpecialBeds = useNarrativeStore(s => s.audioSpecialBeds);
  const audioByLi = useNarrativeStore(s => s.audioByLi);
  const audioSfx = useNarrativeStore(s => s.audioSfx);
  // Гейт экспорта: error-severity issues последнего QA-прогона блокируют
  // кнопку (обходимо явным чекбоксом); не запускавшийся QA — только подсказка.
  const [overrideQaErrors, setOverrideQaErrors] = useState(false);
  const qaRan = qaStatus?.state === 'done';
  const qaErrorCount = qaRan ? qaStatus.issues.filter(i => i.severity === 'error').length : 0;
  const qaBlocked = qaErrorCount > 0 && !overrideQaErrors;

  const beatCount = Object.keys(spineBeatProse).length;
  // Фоны ключуются по loc:<id>.
  const imageCount = Object.entries(images).filter(([k, i]) => i.status === 'done' && k.startsWith('loc:')).length;
  const imageTotal = worldModel ? worldModel.locations.length : 0;
  const characterCount = Object.values(characters).filter(c => c.status === 'done').length;
  const liCount = brief.loveInterests.length;
  const audioReady = audioBase?.status === 'done';

  // Экспорт возможен только при полном календарном стеке: spine+calendar+
  // schedule+worldModel → календарный компилятор (slot-переменная, HUD).
  const canExport = Boolean(spine && calendar && schedule && worldModel);

  const audioInput = {
    base: audioBase,
    moodBeds: audioMoodBeds,
    specialBeds: audioSpecialBeds,
    byLi: audioByLi,
    sfx: audioSfx,
  };

  const onExport = () => {
    if (!canExport) return;
    const result = compileCalendarGameProject(
      brief,
      spine!,
      calendar!,
      schedule!,
      worldModel!,
      spineBeatProse,
      unitProse,
      eventUnits,
      endings,
      images,
      characters,
      audioInput,
    );
    const slug = slugify(result.project.title);
    downloadJson(`${slug}.gu.json`, result.project);
    setTimeout(() => downloadJson('scenes.json', result.scenes), 250);
  };

  return (
    <div className={styles.exportBar}>
      <div className={styles.exportLeft}>
        <span className={styles.exportTitle}>Экспорт в game/-движок</span>
        <span className={styles.exportMeta}>
          {beatCount}/{outline.anchors.length} beat-сцен · {Object.keys(unitProse).length} диалоговых юнитов ·{' '}
          {Object.keys(endings).length} концовок · {imageCount}/{imageTotal} фонов · {characterCount}/{liCount} спрайтов
          {worldModel ? ` · ${worldModel.locations.length} локаций` : ' · без модели мира'}
          {audioReady ? ' · аудио готово' : ' · без аудио'}
          {canExport
            ? ` · календарный компилятор (${calendar!.slotCount} слотов)`
            : ' · нет полного календарного стека'}
          {!qaRan && ' · story QA не запускался'}
          {qaRan && qaErrorCount > 0 && ` · ✗ story QA: ${qaErrorCount} ошибок`}
        </span>
        {qaRan && qaErrorCount > 0 && (
          <label className={styles.qaOverrideRow}>
            <input type="checkbox" checked={overrideQaErrors} onChange={e => setOverrideQaErrors(e.target.checked)} />
            экспортировать несмотря на ошибки
          </label>
        )}
      </div>
      <button
        type="button"
        className={styles.primaryBtn}
        onClick={onExport}
        disabled={qaBlocked || !canExport}
        title={
          !canExport
            ? 'нужен полный календарный стек: хребет, календарь, расписание, мир'
            : qaBlocked
            ? 'story QA нашёл ошибки — исправьте или включите чекбокс обхода'
            : undefined
        }
      >
        Скачать .gu.json + scenes.json
      </button>
    </div>
  );
};

export default Playground;
