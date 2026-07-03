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
  useNarrativeStore,
  useRegeneratePoses,
  CANONICAL_POSES,
  convertStoryToGameProject,
  downloadJson,
  slugify,
  type ArchetypeProfile,
  type StoryOutlineGenStatus,
  type BulkStoryGenStatus,
  type CharacterBulkStatus,
  type ImageBulkStatus,
  type StoryAnchor,
  type StoryOutlinePlan,
  type PoseRegenEntry,
  type PoseRegenStatus,
} from '@/narrative';
import { OutlineGraph, type SelectedSegment } from './OutlineGraph';
import { NarrationWebDrawer } from './NarrationWebDrawer';
import { CharacterRelationshipPanel } from './CharacterRelationshipPanel';
import { BriefEditor } from './BriefEditor';
import { PlaygroundErrorBoundary } from './PlaygroundErrorBoundary';
import styles from './playground.module.css';

const Playground = () => {
  const brief = useBriefStore(s => s.brief);
  const persistedOutline = useNarrativeStore(s => s.storyOutline);
  const [showRawBrief, setShowRawBrief] = useState(false);
  const [showAnchorList, setShowAnchorList] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const issues = useMemo(() => validateBrief(brief), [brief]);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const outlineGen = useStoryOutlineGeneration();
  const bulkGen = useBulkStoryGeneration();
  const imageGen = useBulkImageGeneration();
  const characterGen = useBulkCharacterGeneration();
  const poseRegen = useRegeneratePoses();

  const isBlocked = errorCount > 0;

  const activeOutline = outlineGen.status.state === 'done' ? outlineGen.status.outline : persistedOutline;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <span className={styles.headerTitle}>Procedural Narrative Pilot</span>
          <span className={styles.headerSubtitle}>бриф · архетипы · story pipeline</span>
        </div>
        <nav className={styles.headerNav}>
          <Link className={styles.navLink} to="/">
            ← canvas редактор сцен
          </Link>
        </nav>
      </header>

      <OutlineBar
        status={outlineGen.status}
        disabled={isBlocked}
        onGenerate={() => outlineGen.generate(brief)}
        onReset={outlineGen.reset}
      />

      <PlaygroundErrorBoundary>
        {activeOutline &&
          (() => {
            const outline = activeOutline;
            return (
              <>
                <OutlineGraph outline={outline} onEdgeClick={setSelectedSegment} selected={selectedSegment} />
                <CharacterRelationshipPanel outline={outline} />
                <BulkStoryBar
                  status={bulkGen.status}
                  onStart={() => bulkGen.start(brief, outline)}
                  onCancel={bulkGen.cancel}
                  onReset={bulkGen.reset}
                />
                <ImageGenBar
                  status={imageGen.status}
                  onStart={() => imageGen.start(brief, outline)}
                  onCancel={imageGen.cancel}
                  onReset={imageGen.reset}
                  anchorCount={outline.anchors.length}
                />
                <CharacterGenBar
                  status={characterGen.status}
                  onStart={() => characterGen.start(brief, outline)}
                  onForceStart={() => characterGen.start(brief, outline, { force: true })}
                  onCancel={characterGen.cancel}
                  onReset={characterGen.reset}
                  onRegenMissing={entries => poseRegen.start(entries, brief, outline)}
                  liCount={brief.loveInterests.length}
                />
                <MissingPosesBar
                  regenStatus={poseRegen.status}
                  onStart={entries => poseRegen.start(entries, brief, outline)}
                  onReset={poseRegen.reset}
                />
                <ExportBar outline={outline} />
                <div className={styles.outlineDetailsToggleRow}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setShowAnchorList(v => !v)}>
                    {showAnchorList ? 'Скрыть детальный список' : 'Развернуть детальный список'}
                  </button>
                </div>
                {showAnchorList && <OutlineResult outline={outline} />}
                {selectedSegment && (
                  <NarrationWebDrawer
                    outline={outline}
                    fromId={selectedSegment.fromId}
                    toId={selectedSegment.toId}
                    onClose={() => setSelectedSegment(null)}
                  />
                )}
              </>
            );
          })()}
      </PlaygroundErrorBoundary>

      {outlineGen.status.state === 'done' && outlineGen.status.warnings.length > 0 && (
        <div className={styles.panel}>
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
        <div className={styles.outlineResult}>
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
// BULK STORY GENERATION (narration webs + dialogue variants)
// ────────────────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  world_model: 'World Model',
  beat_plan: 'Beat Plan',
  anchor_beats: 'Anchor Beats',
  narration_webs: 'Narration Webs',
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
          <span className={styles.bulkMeta}>narration webs + dialogue variants · 3 параллельно · ~5–10 минут</span>
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
          Генерация завершена · {status.websGenerated} webs · {status.variantsGenerated} variants
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
            'все narration webs и dialogue variants сгенерированы'
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

const ExportBar: React.FC<{ outline: StoryOutlinePlan }> = ({ outline }) => {
  const brief = useBriefStore(s => s.brief);
  const narrationWebs = useNarrativeStore(s => s.narrationWebs);
  const dialogueVariants = useNarrativeStore(s => s.dialogueVariants);
  const anchorBeats = useNarrativeStore(s => s.anchorBeats);
  const endings = useNarrativeStore(s => s.endings);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const webCount = Object.keys(narrationWebs).length;
  const beatCount = Object.keys(anchorBeats).length;
  const variantCount = Object.keys(dialogueVariants).length;
  // При наличии модели мира фоны ключуются по loc:<id> — считаем только их.
  const imageCount = Object.entries(images).filter(
    ([k, i]) => i.status === 'done' && (worldModel ? k.startsWith('loc:') : !k.startsWith('loc:')),
  ).length;
  const imageTotal = worldModel ? worldModel.locations.length : outline.anchors.length;
  const characterCount = Object.values(characters).filter(c => c.status === 'done').length;
  const edgeCount = outline.anchorEdges.length;
  const liCount = brief.loveInterests.length;

  const onExport = () => {
    const result = convertStoryToGameProject(
      brief,
      outline,
      narrationWebs,
      dialogueVariants,
      anchorBeats,
      endings,
      images,
      characters,
      worldModel,
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
          {beatCount}/{outline.anchors.length} beat-сцен · {webCount}/{edgeCount} narration webs · {variantCount}{' '}
          dialogue variants · {Object.keys(endings).length} концовок · {imageCount}/{imageTotal} фонов ·{' '}
          {characterCount}/{liCount} спрайтов
        </span>
      </div>
      <button type="button" className={styles.primaryBtn} onClick={onExport}>
        Скачать .gu.json + scenes.json
      </button>
    </div>
  );
};

export default Playground;
