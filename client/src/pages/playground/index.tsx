import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  validateBrief,
  useBriefStore,
  useOutlineGeneration,
  useSegmentGeneration,
  useBulkSegmentGeneration,
  useBulkImageGeneration,
  useBulkCharacterGeneration,
  useNarrativeStore,
  useRegeneratePoses,
  CANONICAL_POSES,
  EMOTION_TO_POSE,
  collectUsedEmotions,
  findMissingPoses,
  convertToGameProject,
  type CanonicalPose,
  downloadJson,
  slugify,
  type AnchorPlan,
  type ArchetypeProfile,
  type BulkGenStatus,
  type CharacterBulkStatus,
  type ImageBulkStatus,
  type OutlineGenStatus,
  type OutlinePlan,
  type PoseRegenEntry,
  type PoseRegenStatus,
} from '@/narrative';
import { OutlineGraph, type SelectedSegment } from './OutlineGraph';
import { SegmentDrawer } from './SegmentDrawer';
import { BriefEditor } from './BriefEditor';
import styles from './playground.module.css';

const Playground = () => {
  const brief = useBriefStore(s => s.brief);
  const persistedOutline = useNarrativeStore(s => s.outline);
  const [showRawBrief, setShowRawBrief] = useState(false);
  const [showAnchorList, setShowAnchorList] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const issues = useMemo(() => validateBrief(brief), [brief]);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const outlineGen = useOutlineGeneration();
  const segmentGen = useSegmentGeneration();
  const bulkGen = useBulkSegmentGeneration();
  const imageGen = useBulkImageGeneration();
  const characterGen = useBulkCharacterGeneration();
  const poseRegen = useRegeneratePoses();

  const generatingEdgeIdsRef = useRef<Set<string>>(new Set());
  const generatingEdgeIds = useMemo(() => {
    const next = new Set<string>();
    if (segmentGen.status.state === 'generating') {
      next.add(`${segmentGen.status.fromId}->${segmentGen.status.toId}`);
    }
    if (bulkGen.status.state === 'running') {
      for (const key of bulkGen.status.inFlightKeys) next.add(key);
    }
    const prev = generatingEdgeIdsRef.current;
    if (prev.size === next.size && [...prev].every(k => next.has(k))) return prev;
    generatingEdgeIdsRef.current = next;
    return next;
  }, [segmentGen.status, bulkGen.status]);

  const isBlocked = errorCount > 0;

  // Активный outline = свежесгенерированный, либо закэшированный в localStorage.
  // Это позволяет UI показывать граф и downstream-секции после reload.
  const activeOutline = outlineGen.status.state === 'done' ? outlineGen.status.outline : persistedOutline;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <span className={styles.headerTitle}>Procedural Narrative Pilot</span>
          <span className={styles.headerSubtitle}>бриф · архетипы · валидация</span>
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

      {activeOutline &&
        (() => {
          const outline = activeOutline;
          return (
            <>
              <OutlineGraph
                outline={outline}
                onEdgeClick={setSelectedSegment}
                selected={selectedSegment}
                generatingEdgeIds={generatingEdgeIds}
              />
              <BulkGenBar
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
                outline={outline}
              />
              <MissingPosesBar
                outline={outline}
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
                <SegmentDrawer
                  brief={brief}
                  outline={outline}
                  selection={selectedSegment}
                  status={segmentGen.status}
                  onGenerate={segmentGen.generate}
                  onGeneratePose={(liId, pose) => poseRegen.start([{ liId, pose }], brief, outline)}
                  poseStatuses={poseRegen.poseStatuses}
                  onClose={() => {
                    setSelectedSegment(null);
                    segmentGen.reset();
                  }}
                />
              )}
            </>
          );
        })()}

      {outlineGen.status.state === 'error' && (
        <div className={styles.outlineResult}>
          <div className={styles.errorBox}>Ошибка генерации: {outlineGen.status.message}</div>
        </div>
      )}

      <div className={styles.body}>
        {/* ────────────── ЛЕВАЯ КОЛОНКА: редактор брифа ────────────── */}
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

        {/* ────────────── ПРАВАЯ КОЛОНКА: архетипы ────────────── */}
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
  status: OutlineGenStatus;
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
          status.batchId ? `генерируется... (batch ${status.batchId.slice(0, 8)})` : 'отправка запроса...',
        ];
      case 'done':
        return [styles.statusDotDone, `готово · ${status.outline.anchors.length} якорей`];
      case 'error':
        return [styles.statusDotError, 'ошибка'];
    }
  })();

  return (
    <div className={styles.outlineBar}>
      <div className={styles.outlineBarLeft}>
        <span className={styles.outlineBarTitle}>Outline-генератор</span>
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

const OutlineResult: React.FC<{ outline: OutlinePlan }> = ({ outline }) => {
  // group anchors by route
  const byRoute = useMemo(() => {
    const map = new Map<string, AnchorPlan[]>();
    for (const a of outline.anchors) {
      const list = map.get(a.routeId) ?? [];
      list.push(a);
      map.set(a.routeId, list);
    }
    // sort common first, остальные по имени маршрута
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'common') return -1;
      if (b === 'common') return 1;
      return a.localeCompare(b);
    });
  }, [outline.anchors]);

  return (
    <div className={styles.outlineResult}>
      <div className={styles.outlineHeader}>
        <h2 className={styles.outlineTitle}>{outline.title || 'Без названия'}</h2>
        {outline.logline && <p className={styles.outlineLogline}>{outline.logline}</p>}
        {outline.centralConflict && (
          <p className={styles.outlineConflict}>
            <strong>Центральный конфликт: </strong>
            {outline.centralConflict}
          </p>
        )}
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

      {byRoute.map(([routeId, anchors]) => (
        <div key={routeId} className={`${styles.routeBlock} ${routeId === 'common' ? styles.routeBlockCommon : ''}`}>
          <div className={styles.routeTitle}>
            <span className={styles.routeTitleLi}>{routeId}</span>
            <span style={{ color: '#9ca3af', fontSize: 11 }}>{anchors.length} якорей</span>
          </div>
          {anchors
            .sort((a, b) => a.act - b.act)
            .map(anchor => (
              <AnchorRow key={anchor.id} anchor={anchor} />
            ))}
        </div>
      ))}
    </div>
  );
};

const AnchorRow: React.FC<{ anchor: AnchorPlan }> = ({ anchor }) => {
  const entryReq = anchor.entryStateRequired;
  const flagsReq = entryReq?.flagsRequired ?? [];
  const rangesReq = entryReq?.ranges ?? {};
  return (
    <div className={styles.anchorRow}>
      <div className={styles.anchorIdCell}>
        <span className={styles.anchorIdName}>{anchor.id}</span>
        <span className={styles.anchorTypeTag}>
          {anchor.type} · акт {anchor.act}
          {anchor.characterFocus ? ` · ${anchor.characterFocus}` : ''}
        </span>
      </div>
      <div className={styles.anchorBodyCell}>
        <span>{anchor.summary}</span>
        {(flagsReq.length > 0 || Object.keys(rangesReq).length > 0) && (
          <div>
            {flagsReq.map(f => (
              <span key={f} className={styles.anchorEntryReq}>
                flag: {f}
              </span>
            ))}
            {Object.entries(rangesReq).map(([path, range]) => (
              <span key={path} className={styles.anchorEntryReq}>
                {path} ∈ [{range[0]}, {range[1]}]
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
// BULK SEGMENT GENERATION (все сегменты outline-а в один клик)
// ────────────────────────────────────────────────────────────────────────────

const BulkGenBar: React.FC<{
  status: BulkGenStatus;
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
}> = ({ status, onStart, onCancel, onReset }) => {
  if (status.state === 'idle') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>Bulk-генерация всех сегментов</span>
          <span className={styles.bulkMeta}>
            запустит сразу 3 LLM-вызова, остальные встанут в очередь · ~5–10 минут на полный outline
          </span>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={onStart}>
          Сгенерировать все сегменты
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
            Bulk-генерация · {status.completed} / {status.total}
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

  // state === 'done'
  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkLeft}>
        <span className={styles.bulkTitle}>
          Bulk-генерация завершена · {status.completed} / {status.total}
          {status.cancelled && ' (остановлено)'}
        </span>
        <span className={styles.bulkMeta}>
          {status.failures.length > 0 ? (
            <>
              ✗ {status.failures.length} ошибок:{' '}
              {status.failures
                .slice(0, 3)
                .map(f => `${f.fromId}→${f.toId}`)
                .join(', ')}
              {status.failures.length > 3 && ` и ещё ${status.failures.length - 3}`}
            </>
          ) : (
            'все сегменты сгенерированы успешно'
          )}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {status.failures.length > 0 && (
          <button type="button" className={styles.secondaryBtn} onClick={onReset}>
            Скрыть
          </button>
        )}
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
  outline: OutlinePlan;
}> = ({ status, onStart, onForceStart, onCancel, onReset, onRegenMissing, liCount, outline }) => {
  const characters = useNarrativeStore(s => s.characters);
  const segments = useNarrativeStore(s => s.segments);
  const cachedDone = Object.values(characters).filter(c => c.status === 'done').length;
  const allDone = liCount > 0 && cachedDone >= liCount;

  const poseStats = useMemo(() => {
    const used = collectUsedEmotions(segments, outline);
    const missing = findMissingPoses(used, characters);

    let totalNeeded = 0;
    let totalExisting = 0;
    for (const [charId, emotions] of used) {
      const state = characters[charId];
      const hasPoses = state?.status === 'done';
      for (const e of emotions) {
        const n = e.toLowerCase().trim();
        if (n === 'idle' || n === 'neutral' || n === 'calm') continue;
        totalNeeded++;
        if (hasPoses) {
          const mapped = EMOTION_TO_POSE[n];
          const pose = mapped ?? n;
          if (pose !== 'idle' && state.poseFilenames?.[pose]) totalExisting++;
          else if (CANONICAL_POSES.includes(pose as CanonicalPose) && state.poseFilenames?.[pose]) totalExisting++;
        }
      }
    }
    totalNeeded += liCount;
    totalExisting += cachedDone;

    const missingEntries: PoseRegenEntry[] = [];
    for (const [liId, poses] of missing) {
      for (const pose of poses) missingEntries.push({ liId, pose });
    }

    return { totalNeeded, totalExisting, missingEntries, missingCount: missingEntries.length };
  }, [segments, outline, characters, liCount, cachedDone]);

  if (status.state === 'idle') {
    return (
      <div className={styles.bulkBar}>
        <div className={styles.bulkLeft}>
          <span className={styles.bulkTitle}>
            Генерация спрайтов персонажей · {cachedDone} / {liCount} готово
          </span>
          <span className={styles.bulkMeta}>
            {poseStats.totalExisting} / {poseStats.totalNeeded} поз (idle + эмоции)
            {poseStats.missingCount > 0 && ` · ${poseStats.missingCount} не хватает`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {allDone && poseStats.missingCount > 0 && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => onRegenMissing(poseStats.missingEntries)}
            >
              Догенерировать ({poseStats.missingCount})
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
  outline: OutlinePlan;
  regenStatus: PoseRegenStatus;
  onStart: (entries: PoseRegenEntry[]) => void;
  onReset: () => void;
}> = ({ outline, regenStatus, onStart, onReset }) => {
  const segments = useNarrativeStore(s => s.segments);
  const characters = useNarrativeStore(s => s.characters);
  const [expanded, setExpanded] = useState(false);

  const missingData = useMemo(() => {
    const hasSegments = Object.keys(segments).length > 0;
    const hasCharacters = Object.values(characters).some(c => c.status === 'done');
    if (!hasSegments || !hasCharacters) return null;

    const used = collectUsedEmotions(segments, outline);
    const missing = findMissingPoses(used, characters);
    if (missing.size === 0) return null;

    const entries: PoseRegenEntry[] = [];
    for (const [liId, poses] of missing) {
      for (const pose of poses) entries.push({ liId, pose });
    }
    return { missing, entries, totalPoses: entries.length, totalChars: missing.size };
  }, [segments, characters, outline]);

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

const ExportBar: React.FC<{ outline: OutlinePlan }> = ({ outline }) => {
  const brief = useBriefStore(s => s.brief);
  const segments = useNarrativeStore(s => s.segments);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const segmentCount = Object.keys(segments).length;
  const imageCount = Object.values(images).filter(i => i.status === 'done').length;
  const characterCount = Object.values(characters).filter(c => c.status === 'done').length;
  const edgeCount = outline.anchorEdges.length;
  const liCount = brief.loveInterests.length;

  const onExport = () => {
    const result = convertToGameProject(brief, outline, segments, images, characters);
    const slug = slugify(result.project.title);
    downloadJson(`${slug}.gu.json`, result.project);
    // Небольшой timeout, чтобы браузер не схлопнул два «download» подряд.
    setTimeout(() => downloadJson('scenes.json', result.scenes), 250);
  };

  return (
    <div className={styles.exportBar}>
      <div className={styles.exportLeft}>
        <span className={styles.exportTitle}>Экспорт в game/-движок</span>
        <span className={styles.exportMeta}>
          {segmentCount}/{edgeCount} сегментов · {imageCount}/{outline.anchors.length} фонов · {characterCount}/
          {liCount} спрайтов
          {segmentCount < edgeCount && (
            <span className={styles.exportHint}> · placeholder-переходы для несгенерированных</span>
          )}
        </span>
      </div>
      <button type="button" className={styles.primaryBtn} onClick={onExport}>
        Скачать .gu.json + scenes.json
      </button>
    </div>
  );
};

export default Playground;
