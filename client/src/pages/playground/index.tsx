import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  validateBrief,
  useBriefStore,
  useStoryOutlineGeneration,
  useBulkStoryGeneration,
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
  convertStoryToGameProject,
  compileWorldGameProject,
  downloadJson,
  slugify,
  type ArchetypeProfile,
  type LocationMood,
  type SpecialAmbientKind,
  type StoryOutlineGenStatus,
  type BulkStoryGenStatus,
  type CharacterBulkStatus,
  type ImageBulkStatus,
  type AudioBulkStatus,
  type StoryAnchor,
  type StoryOutlinePlan,
  type PoseRegenEntry,
  type PoseRegenStatus,
  type Brief,
} from '@/narrative';
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
  const persistedOutline = useNarrativeStore(s => s.storyOutline);
  const issues = useMemo(() => validateBrief(brief), [brief]);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const outlineGen = useStoryOutlineGeneration();
  const bulkGen = useBulkStoryGeneration();
  const imageGen = useBulkImageGeneration();
  const characterGen = useBulkCharacterGeneration();
  const poseRegen = useRegeneratePoses();
  const audioGen = useBulkAudioGeneration();

  const isBlocked = errorCount > 0;
  const activeOutline = outlineGen.status.state === 'done' ? outlineGen.status.outline : persistedOutline;

  const [activeSection, setActiveSection] = useState<SectionId>(() => (persistedOutline ? 'graph' : 'brief'));
  const [graphView, setGraphView] = useState<GraphView>('montage');

  // Статусы пайплайна для чипов топ-бара.
  const anchorBeats = useNarrativeStore(s => s.anchorBeats);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioByLi = useNarrativeStore(s => s.audioByLi);

  const chips = useMemo<ChipSpec[]>(() => {
    const anchorCount = activeOutline?.anchors.length ?? 0;
    const liCount = brief.loveInterests.length;
    const beatsDone = Object.keys(anchorBeats).length;
    const imagesDone = Object.entries(images).filter(
      ([k, i]) => i.status === 'done' && (worldModel ? k.startsWith('loc:') : !k.startsWith('loc:')),
    ).length;
    const imagesTotal = worldModel ? worldModel.locations.length : anchorCount;
    const charsDone = Object.values(characters).filter(c => c.status === 'done').length;
    const audioDone =
      (audioBase?.status === 'done' ? 1 : 0) +
      Object.values(audioByLi).reduce(
        (acc, li) => acc + (li.positive?.status === 'done' ? 1 : 0) + (li.negative?.status === 'done' ? 1 : 0),
        0,
      );
    return [
      {
        key: 'outline',
        target: 'brief',
        label: activeOutline ? 'Outline ✓' : 'Outline —',
        dot: outlineGen.status.state === 'generating' ? CHIP_RUNNING : activeOutline ? CHIP_DONE : CHIP_IDLE,
      },
      progressChip('scenes', 'Сцены', beatsDone, anchorCount, bulkGen.status.state === 'running', 'graph'),
      progressChip('images', 'Фоны', imagesDone, imagesTotal, imageGen.status.state === 'running', 'graph'),
      progressChip('sprites', 'Спрайты', charsDone, liCount, characterGen.status.state === 'running', 'heroes'),
      progressChip('audio', 'Аудио', audioDone, 1 + liCount * 2, audioGen.status.state === 'running', 'audio'),
    ];
  }, [
    activeOutline,
    brief.loveInterests.length,
    anchorBeats,
    images,
    characters,
    worldModel,
    audioBase,
    audioByLi,
    outlineGen.status.state,
    bulkGen.status.state,
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

        {activeSection === 'brief' && (
          <BriefSection brief={brief} issues={issues} outlineGen={outlineGen} isBlocked={isBlocked} />
        )}

        {activeSection === 'graph' && (
          <div className={styles.sectionScroll}>
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
                  {graphView === 'montage' && <MontageBoard outline={activeOutline} />}
                </div>
                {graphView === 'flow' && <OutlineGraph outline={activeOutline} />}
                {graphView === 'list' && <OutlineResult outline={activeOutline} />}
                <BulkStoryBar
                  status={bulkGen.status}
                  onStart={() => bulkGen.start(brief, activeOutline)}
                  onCancel={bulkGen.cancel}
                  onReset={bulkGen.reset}
                />
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
                <span>Монтажный стол строится по story outline — сначала сгенерируйте его из брифа.</span>
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
                <ExportBar outline={activeOutline} />
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
// СЕКЦИЯ «БРИФ» (бриф + валидация + архетипы + генерация outline)
// ────────────────────────────────────────────────────────────────────────────

const BriefSection: React.FC<{
  brief: Brief;
  issues: ReturnType<typeof validateBrief>;
  outlineGen: ReturnType<typeof useStoryOutlineGeneration>;
  isBlocked: boolean;
}> = ({ brief, issues, outlineGen, isBlocked }) => {
  const [showRawBrief, setShowRawBrief] = useState(false);

  return (
    <div className={styles.sectionScroll}>
      <div style={{ marginTop: 16 }}>
        <OutlineBar
          status={outlineGen.status}
          disabled={isBlocked}
          onGenerate={() => outlineGen.generate(brief)}
          onReset={outlineGen.reset}
        />
      </div>

      {outlineGen.status.state === 'done' && outlineGen.status.warnings.length > 0 && (
        <div className={styles.sectionPad}>
          <div className={styles.errorBox}>
            {outlineGen.status.warnings.map(w => (
              <div key={w.scope}>
                ⚠ {w.scope}: {w.message}
              </div>
            ))}
          </div>
        </div>
      )}
      {outlineGen.status.state === 'error' && (
        <div className={styles.sectionPad}>
          <div className={styles.errorBox}>Ошибка генерации: {outlineGen.status.message}</div>
        </div>
      )}

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
// OUTLINE GENERATION
// ────────────────────────────────────────────────────────────────────────────

const OutlineBar: React.FC<{
  status: StoryOutlineGenStatus;
  disabled: boolean;
  onGenerate: () => void;
  onReset: () => void;
}> = ({ status, disabled, onGenerate, onReset }) => {
  const [statusDot, statusLabel] = (() => {
    switch (status.state) {
      case 'idle':
        return [styles.statusDotIdle, 'не запускалось'];
      case 'generating':
        return [
          styles.statusDotGen,
          status.batchId
            ? `генерируется... (попытка ${status.attempt}, batch ${status.batchId.slice(0, 8)})`
            : 'отправка запроса...',
        ];
      case 'done':
        return [
          styles.statusDotDone,
          `готово · ${status.outline.anchors.length} якорей${
            status.warnings.length > 0 ? ` · ⚠ ${status.warnings.length} предупреждений` : ''
          }`,
        ];
      case 'error':
        return [styles.statusDotError, 'ошибка'];
    }
  })();

  return (
    <div className={styles.outlineBar}>
      <div className={styles.outlineBarLeft}>
        <span className={styles.outlineBarTitle}>Story Outline</span>
        <span className={styles.outlineBarMeta}>
          <span className={`${styles.statusDot} ${statusDot}`} />
          {statusLabel}
          {disabled && ' · бриф невалиден, исправь ошибки сначала'}
        </span>
      </div>
      <div className={styles.outlineBarRight}>
        {status.state === 'done' && (
          <button type="button" className={styles.secondaryBtn} onClick={onReset}>
            Сбросить
          </button>
        )}
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onGenerate}
          disabled={disabled || status.state === 'generating'}
        >
          {status.state === 'generating'
            ? 'Генерация...'
            : status.state === 'done'
            ? 'Перегенерировать'
            : 'Сгенерировать outline'}
        </button>
      </div>
    </div>
  );
};

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
// BULK STORY GENERATION (world model + beats + dialogue variants + endings)
// ────────────────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  world_model: 'World Model',
  beat_plan: 'Beat Plan',
  anchor_beats: 'Anchor Beats',
  dialogue_variants: 'Dialogue Variants',
  endings: 'Endings',
};

const BulkStoryBar: React.FC<{
  status: BulkStoryGenStatus;
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
}> = ({ status, onStart, onCancel, onReset }) => {
  if (status.state === 'idle') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>Bulk Story Generation</span>
          <span className={styles.bulkMeta}>мир + beat-сцены + диалоги + концовки · 3 параллельно · ~5–10 минут</span>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={onStart}>
          Сгенерировать всё
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
            {PHASE_LABEL[status.phase] ?? status.phase} · {status.completed} / {status.total}
            {status.cancelled && ' (отменяется...)'}
          </span>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.bulkMeta}>
            ⚙ в процессе: {status.inFlight}
            {status.failures.length > 0 && ` · ✗ ошибок: ${status.failures.length}`}
          </span>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={status.cancelled}>
          {status.cancelled ? 'Отменяется...' : 'Остановить'}
        </button>
      </div>
    );
  }

  // state === 'done'
  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkLeft}>
        <span className={styles.bulkTitle}>
          Генерация завершена · {status.beatsGenerated} beats · {status.variantsGenerated} variants ·{' '}
          {status.endingsGenerated} endings
          {status.cancelled && ' (остановлено)'}
        </span>
        <span className={styles.bulkMeta}>
          {status.failures.length > 0 ? (
            <>
              ✗ {status.failures.length} ошибок:{' '}
              {status.failures
                .slice(0, 3)
                .map(f => f.key)
                .join(', ')}
              {status.failures.length > 3 && ` и ещё ${status.failures.length - 3}`}
            </>
          ) : (
            'все артефакты сгенерированы и валидны'
          )}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={styles.secondaryBtn} onClick={onReset}>
          OK
        </button>
      </div>
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

const ExportBar: React.FC<{ outline: StoryOutlinePlan }> = ({ outline }) => {
  const brief = useBriefStore(s => s.brief);
  const dialogueVariants = useNarrativeStore(s => s.dialogueVariants);
  const anchorBeats = useNarrativeStore(s => s.anchorBeats);
  const endings = useNarrativeStore(s => s.endings);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioMoodBeds = useNarrativeStore(s => s.audioMoodBeds);
  const audioSpecialBeds = useNarrativeStore(s => s.audioSpecialBeds);
  const audioByLi = useNarrativeStore(s => s.audioByLi);
  const audioSfx = useNarrativeStore(s => s.audioSfx);
  const beatCount = Object.keys(anchorBeats).length;
  const variantCount = Object.keys(dialogueVariants).length;
  // При наличии модели мира фоны ключуются по loc:<id> — считаем только их.
  const imageCount = Object.entries(images).filter(
    ([k, i]) => i.status === 'done' && (worldModel ? k.startsWith('loc:') : !k.startsWith('loc:')),
  ).length;
  const imageTotal = worldModel ? worldModel.locations.length : outline.anchors.length;
  const characterCount = Object.values(characters).filter(c => c.status === 'done').length;
  const liCount = brief.loveInterests.length;
  const audioReady = audioBase?.status === 'done';

  const onExport = () => {
    // С моделью мира игра компилируется как стейт-машина по графу локаций
    // (свободное перемещение, события/встречи гейтятся состоянием); без неё —
    // легаси-конвертация (прямые рёбра якорь→якорь, без аудио).
    const result = worldModel
      ? compileWorldGameProject(
          brief,
          outline,
          worldModel,
          dialogueVariants,
          anchorBeats,
          endings,
          images,
          characters,
          {
            base: audioBase,
            moodBeds: audioMoodBeds,
            specialBeds: audioSpecialBeds,
            byLi: audioByLi,
            sfx: audioSfx,
          },
        )
      : convertStoryToGameProject(brief, outline, {}, dialogueVariants, anchorBeats, endings, images, characters, null);
    const slug = slugify(result.project.title);
    downloadJson(`${slug}.gu.json`, result.project);
    setTimeout(() => downloadJson('scenes.json', result.scenes), 250);
  };

  return (
    <div className={styles.exportBar}>
      <div className={styles.exportLeft}>
        <span className={styles.exportTitle}>Экспорт в game/-движок</span>
        <span className={styles.exportMeta}>
          {beatCount}/{outline.anchors.length} beat-сцен · {variantCount} dialogue variants ·{' '}
          {Object.keys(endings).length} концовок · {imageCount}/{imageTotal} фонов · {characterCount}/{liCount} спрайтов
          {worldModel ? ` · ${worldModel.locations.length} локаций` : ' · без модели мира'}
          {audioReady ? ' · аудио готово' : ' · без аудио'}
        </span>
      </div>
      <button type="button" className={styles.primaryBtn} onClick={onExport}>
        Скачать .gu.json + scenes.json
      </button>
    </div>
  );
};

export default Playground;
