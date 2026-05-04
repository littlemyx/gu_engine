import React, { useMemo } from 'react';
import {
  getSegmentValidations,
  useNarrativeStore,
  type AnchorPlan,
  type Brief,
  type DraftScene,
  type GeneratedSegment,
  type OutlinePlan,
  type SegmentGenStatus,
  type SegmentIssue,
} from '@/narrative';
import styles from './SegmentDrawer.module.css';

type Props = {
  brief: Brief;
  outline: OutlinePlan;
  selection: { fromId: string; toId: string };
  status: SegmentGenStatus;
  onGenerate: (
    brief: Brief,
    outline: OutlinePlan,
    fromId: string,
    toId: string,
    retry?: { previousAttempt: GeneratedSegment; previousIssues: SegmentIssue[] },
  ) => void;
  onClose: () => void;
};

type DisplayState =
  | { kind: 'idle' }
  | { kind: 'generating'; batchId: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; segment: GeneratedSegment; issues: SegmentIssue[]; fromStore: boolean };

export const SegmentDrawer: React.FC<Props> = ({ brief, outline, selection, status, onGenerate, onClose }) => {
  const anchorFrom = outline.anchors.find(a => a.id === selection.fromId);
  const anchorTo = outline.anchors.find(a => a.id === selection.toId);
  const storedSegment = useNarrativeStore(s => s.segments[`${selection.fromId}->${selection.toId}`]);
  const storedIssues = useMemo(
    () => (storedSegment ? getSegmentValidations(brief, outline, selection.fromId, selection.toId, storedSegment) : []),
    [storedSegment, brief, outline, selection.fromId, selection.toId],
  );
  if (!anchorFrom || !anchorTo) return null;

  const matchesSelection =
    (status.state === 'generating' || status.state === 'done' || status.state === 'error') &&
    status.fromId === selection.fromId &&
    status.toId === selection.toId;

  const displayState: DisplayState = (() => {
    if (matchesSelection) {
      if (status.state === 'generating') return { kind: 'generating', batchId: status.batchId };
      if (status.state === 'error') return { kind: 'error', message: status.message };
      if (status.state === 'done')
        return { kind: 'done', segment: status.segment, issues: status.issues, fromStore: false };
    }
    if (storedSegment) return { kind: 'done', segment: storedSegment, issues: storedIssues, fromStore: true };
    return { kind: 'idle' };
  })();

  const isDone = displayState.kind === 'done';
  const hasIssues = isDone && displayState.issues.length > 0;
  const retryContext =
    isDone && hasIssues ? { previousAttempt: displayState.segment, previousIssues: displayState.issues } : undefined;

  return (
    <aside className={styles.drawer}>
      <header className={styles.drawerHeader}>
        <div className={styles.drawerTitleRow}>
          <h3 className={styles.drawerTitle}>Сегмент</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className={styles.anchorPair}>
          <AnchorMini anchor={anchorFrom} />
          <span className={styles.arrow}>→</span>
          <AnchorMini anchor={anchorTo} />
        </div>
      </header>

      <section className={styles.drawerActions}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={displayState.kind === 'generating'}
          onClick={() => onGenerate(brief, outline, selection.fromId, selection.toId, retryContext)}
        >
          {displayState.kind === 'generating'
            ? 'Генерация...'
            : hasIssues
            ? 'Перегенерировать с фидбэком'
            : isDone
            ? 'Перегенерировать сегмент'
            : 'Сгенерировать сегмент'}
        </button>
        {displayState.kind === 'generating' && (
          <span className={styles.statusInline}>
            <span className={`${styles.statusDot} ${styles.statusDotGen}`} />
            идёт LLM-вызов · batch {displayState.batchId.slice(0, 8) || '...'}
          </span>
        )}
        {displayState.kind === 'done' && (
          <span className={styles.statusInline}>
            <span className={`${styles.statusDot} ${styles.statusDotDone}`} />
            готово · {displayState.segment.scenes.length} сцен
            {displayState.issues.length > 0 && ` · ${displayState.issues.length} замечаний`}
          </span>
        )}
        {displayState.kind === 'error' && (
          <span className={styles.statusInline}>
            <span className={`${styles.statusDot} ${styles.statusDotError}`} />
            ошибка
          </span>
        )}
      </section>

      <div className={styles.drawerBody}>
        {displayState.kind === 'idle' ? (
          <div className={styles.placeholder}>
            Сегмент ещё не сгенерирован. Нажми кнопку выше — LLM соберёт DAG из 3-6 сцен, который переведёт игрока из
            state(<code>{anchorFrom.id}</code>) в state(
            <code>{anchorTo.id}</code>).
          </div>
        ) : displayState.kind === 'generating' ? (
          <div className={styles.placeholder}>Генерируется...</div>
        ) : displayState.kind === 'error' ? (
          <div className={styles.errorBox}>Ошибка: {displayState.message}</div>
        ) : (
          <SegmentResult
            segment={displayState.segment}
            issues={displayState.issues}
            entrySceneId={displayState.segment.entrySceneId}
          />
        )}
      </div>
    </aside>
  );
};

const AnchorMini: React.FC<{ anchor: AnchorPlan }> = ({ anchor }) => (
  <div className={styles.anchorMini}>
    <span className={styles.anchorMiniId}>{anchor.id}</span>
    <span className={styles.anchorMiniType}>{anchor.type}</span>
  </div>
);

const SegmentResult: React.FC<{
  segment: GeneratedSegment;
  issues: SegmentIssue[];
  entrySceneId: string;
}> = ({ segment, issues, entrySceneId }) => {
  return (
    <>
      {issues.length > 0 && (
        <div className={styles.issuesBlock}>
          {issues.map((it, i) => (
            <div key={i} className={it.severity === 'error' ? styles.issueError : styles.issueWarning}>
              <span className={styles.issueScope}>{it.scope}</span>
              {it.message}
            </div>
          ))}
        </div>
      )}
      <div className={styles.scenesList}>
        {segment.scenes.map(scene => (
          <SceneCard key={scene.id} scene={scene} isEntry={scene.id === entrySceneId} />
        ))}
      </div>
    </>
  );
};

const SceneCard: React.FC<{ scene: DraftScene; isEntry: boolean }> = ({ scene, isEntry }) => {
  return (
    <div className={`${styles.sceneCard} ${isEntry ? styles.sceneCardEntry : ''}`}>
      <div className={styles.sceneHeader}>
        <span className={styles.sceneId}>{scene.id}</span>
        {isEntry && <span className={styles.entryBadge}>entry</span>}
      </div>
      <div className={styles.sceneMeta}>
        <span>{scene.location}</span>
        {scene.timeMarker && (
          <>
            <span className={styles.metaSep}>·</span>
            <span>{scene.timeMarker}</span>
          </>
        )}
        {scene.charactersPresent.length > 0 && (
          <>
            <span className={styles.metaSep}>·</span>
            <span>{scene.charactersPresent.join(', ')}</span>
          </>
        )}
      </div>
      <p className={styles.narration}>{scene.narration}</p>
      {scene.dialogue.length > 0 && (
        <div className={styles.dialogue}>
          {scene.dialogue.map((line, i) => (
            <div key={i} className={styles.dialogueLine}>
              <span className={styles.speaker}>{line.speaker}</span>
              {line.emotion && <span className={styles.emotion}>({line.emotion})</span>}
              <span className={styles.lineText}>{line.line}</span>
            </div>
          ))}
        </div>
      )}
      {scene.choices.length > 0 && (
        <div className={styles.choices}>
          {scene.choices.map(choice => (
            <div key={choice.id} className={styles.choice}>
              <div className={styles.choiceText}>→ {choice.text}</div>
              <div className={styles.choiceMeta}>
                {Object.entries(choice.effects.stateDeltas).map(([path, delta]) => (
                  <span key={path} className={delta >= 0 ? styles.deltaPos : styles.deltaNeg}>
                    {path.replace('relationship[', '').replace(']', '')} {delta >= 0 ? '+' : ''}
                    {delta}
                  </span>
                ))}
                {choice.effects.flagSet.map(f => (
                  <span key={f} className={styles.flagSet}>
                    +{f}
                  </span>
                ))}
                {choice.effects.flagClear.map(f => (
                  <span key={f} className={styles.flagClear}>
                    -{f}
                  </span>
                ))}
                <span className={styles.next}>
                  → {choice.nextSceneId === null ? <strong>(к anchorTo)</strong> : choice.nextSceneId}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
