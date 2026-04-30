import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  SAMPLE_BRIEF,
  validateBrief,
  useOutlineGeneration,
  useSegmentGeneration,
  useBulkSegmentGeneration,
  useBulkImageGeneration,
  useNarrativeStore,
  convertToGameProject,
  downloadJson,
  slugify,
  type AnchorPlan,
  type ArchetypeProfile,
  type Brief,
  type BulkGenStatus,
  type ImageBulkStatus,
  type LoveInterestCard,
  type OutlineGenStatus,
  type OutlinePlan,
} from '@/narrative';
import { OutlineGraph, type SelectedSegment } from './OutlineGraph';
import { SegmentDrawer } from './SegmentDrawer';
import styles from './playground.module.css';

const Playground = () => {
  const [showRawBrief, setShowRawBrief] = useState(false);
  const [showAnchorList, setShowAnchorList] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const issues = useMemo(() => validateBrief(SAMPLE_BRIEF), []);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const outlineGen = useOutlineGeneration();
  const segmentGen = useSegmentGeneration();
  const bulkGen = useBulkSegmentGeneration();
  const imageGen = useBulkImageGeneration();

  const isBlocked = errorCount > 0;

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
        onGenerate={() => outlineGen.generate(SAMPLE_BRIEF)}
        onReset={outlineGen.reset}
      />

      {outlineGen.status.state === 'done' &&
        (() => {
          const outline = outlineGen.status.outline;
          return (
            <>
              <OutlineGraph outline={outline} onEdgeClick={setSelectedSegment} selected={selectedSegment} />
              <BulkGenBar
                status={bulkGen.status}
                onStart={() => bulkGen.start(SAMPLE_BRIEF, outline)}
                onCancel={bulkGen.cancel}
                onReset={bulkGen.reset}
              />
              <ImageGenBar
                status={imageGen.status}
                onStart={() => imageGen.start(SAMPLE_BRIEF, outline)}
                onCancel={imageGen.cancel}
                onReset={imageGen.reset}
                anchorCount={outline.anchors.length}
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
                  brief={SAMPLE_BRIEF}
                  outline={outline}
                  selection={selectedSegment}
                  status={segmentGen.status}
                  onGenerate={segmentGen.generate}
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
        {/* ────────────── ЛЕВАЯ КОЛОНКА: бриф ────────────── */}
        <div className={styles.column}>
          <BriefSummary brief={SAMPLE_BRIEF} errorCount={errorCount} warningCount={warningCount} />
          <BriefIssues issues={issues} />
          <LoveInterestList loveInterests={SAMPLE_BRIEF.loveInterests} />

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
            {showRawBrief && <pre className={styles.jsonBlock}>{JSON.stringify(SAMPLE_BRIEF, null, 2)}</pre>}
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

const BriefSummary: React.FC<{
  brief: Brief;
  errorCount: number;
  warningCount: number;
}> = ({ brief, errorCount, warningCount }) => {
  const validityLabel =
    errorCount === 0
      ? warningCount === 0
        ? 'валидный'
        : `валидный, ${warningCount} предупреждений`
      : `ошибок: ${errorCount}`;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Бриф{' '}
        <span className={styles.sectionMeta}>
          v{brief.version} · {validityLabel}
        </span>
      </h2>
      <div className={styles.kvList}>
        <span className={styles.kvKey}>genre</span>
        <span className={styles.kvVal}>{brief.genre}</span>
        <span className={styles.kvKey}>format</span>
        <span className={styles.kvVal}>{brief.format}</span>
        <span className={styles.kvKey}>scale</span>
        <span className={styles.kvVal}>
          {brief.scale.acts} акта · ~{brief.scale.targetDurationMinutes} мин · плотность {brief.scale.branchingDensity}{' '}
          · common-route = {brief.scale.commonRouteShare}
        </span>
        <span className={styles.kvKey}>endings</span>
        <span className={styles.kvVal}>{brief.endingsProfile.join(' / ')}</span>
        <span className={styles.kvKey}>setting</span>
        <span className={styles.kvVal}>
          {brief.world.setting.era} · {brief.world.setting.place} — {brief.world.setting.specifics}
        </span>
        <span className={styles.kvKey}>tone</span>
        <span className={styles.kvVal}>
          {brief.world.tone.mood} · intensity={brief.world.tone.intensity}
          {brief.world.tone.themes.length > 0 && <> · {brief.world.tone.themes.join(', ')}</>}
        </span>
        <span className={styles.kvKey}>protagonist</span>
        <span className={styles.kvVal}>
          {brief.protagonist.gender} ({brief.protagonist.voiceStyle})
        </span>
        <span className={styles.kvKey}>art</span>
        <span className={styles.kvVal}>{brief.artStyle.referenceDescriptor}</span>
      </div>
    </section>
  );
};

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

const LoveInterestList: React.FC<{
  loveInterests: LoveInterestCard[];
}> = ({ loveInterests }) => {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Love interests <span className={styles.sectionMeta}>{loveInterests.length} карточки</span>
      </h2>
      {loveInterests.map(li => (
        <div key={li.id} className={styles.briefCard}>
          <div className={styles.briefCardHeader}>
            <span className={styles.briefCardName}>
              {li.name}, {li.age}
            </span>
            <span className={styles.briefCardArchetype}>{li.archetype}</span>
          </div>
          <div className={styles.briefCardRole}>{li.roleInWorld}</div>
          <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
            <em>{li.speechPattern}</em>
          </div>
          <div className={styles.tagRow}>
            {li.personality.traits.map(t => (
              <span key={t} className={styles.tag}>
                {t}
              </span>
            ))}
          </div>
          {li.archetypeSpecifics && Object.keys(li.archetypeSpecifics).length > 0 && (
            <div className={styles.tagRow}>
              {Object.entries(li.archetypeSpecifics).map(([k, v]) => (
                <span key={k} className={styles.tag} style={{ background: '#eef2ff', color: '#4338ca' }}>
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
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
// EXPORT BAR (.gu.json + scenes.json для game/-движка)
// ────────────────────────────────────────────────────────────────────────────

const ExportBar: React.FC<{ outline: OutlinePlan }> = ({ outline }) => {
  const segments = useNarrativeStore(s => s.segments);
  const images = useNarrativeStore(s => s.images);
  const segmentCount = Object.keys(segments).length;
  const imageCount = Object.values(images).filter(i => i.status === 'done').length;
  const edgeCount = outline.anchorEdges.length;

  const onExport = () => {
    const result = convertToGameProject(SAMPLE_BRIEF, outline, segments, images);
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
          {segmentCount} из {edgeCount} сегментов · {imageCount} из {outline.anchors.length} фонов
          {segmentCount < edgeCount && (
            <span className={styles.exportHint}> · остальные станут placeholder-переходами без сцен</span>
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
