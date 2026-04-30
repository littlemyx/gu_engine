import React from 'react';
import type {
  AnchorPlan,
  Brief,
  DraftScene,
  GeneratedSegment,
  OutlinePlan,
  SegmentGenStatus,
  SegmentIssue,
} from '@/narrative';
import styles from './SegmentDrawer.module.css';

type Props = {
  brief: Brief;
  outline: OutlinePlan;
  selection: { fromId: string; toId: string };
  status: SegmentGenStatus;
  onGenerate: (brief: Brief, outline: OutlinePlan, fromId: string, toId: string) => void;
  onClose: () => void;
};

export const SegmentDrawer: React.FC<Props> = ({ brief, outline, selection, status, onGenerate, onClose }) => {
  const anchorFrom = outline.anchors.find(a => a.id === selection.fromId);
  const anchorTo = outline.anchors.find(a => a.id === selection.toId);
  if (!anchorFrom || !anchorTo) return null;

  const matchesSelection =
    (status.state === 'generating' || status.state === 'done' || status.state === 'error') &&
    status.fromId === selection.fromId &&
    status.toId === selection.toId;

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
          disabled={matchesSelection && status.state === 'generating'}
          onClick={() => onGenerate(brief, outline, selection.fromId, selection.toId)}
        >
          {matchesSelection && status.state === 'generating'
            ? 'Генерация...'
            : matchesSelection && status.state === 'done'
            ? 'Перегенерировать сегмент'
            : 'Сгенерировать сегмент'}
        </button>
        {matchesSelection && status.state === 'generating' && (
          <span className={styles.statusInline}>
            <span className={`${styles.statusDot} ${styles.statusDotGen}`} />
            идёт LLM-вызов · batch {status.batchId.slice(0, 8) || '...'}
          </span>
        )}
        {matchesSelection && status.state === 'done' && (
          <span className={styles.statusInline}>
            <span className={`${styles.statusDot} ${styles.statusDotDone}`} />
            готово · {status.segment.scenes.length} сцен
            {status.issues.length > 0 && ` · ${status.issues.length} замечаний`}
          </span>
        )}
        {matchesSelection && status.state === 'error' && (
          <span className={styles.statusInline}>
            <span className={`${styles.statusDot} ${styles.statusDotError}`} />
            ошибка
          </span>
        )}
      </section>

      <div className={styles.drawerBody}>
        {!matchesSelection ? (
          <div className={styles.placeholder}>
            Сегмент ещё не сгенерирован. Нажми кнопку выше — LLM соберёт DAG из 3-6 сцен, который переведёт игрока из
            state(<code>{anchorFrom.id}</code>) в state(
            <code>{anchorTo.id}</code>).
          </div>
        ) : status.state === 'generating' ? (
          <div className={styles.placeholder}>Генерируется...</div>
        ) : status.state === 'error' ? (
          <div className={styles.errorBox}>Ошибка: {status.message}</div>
        ) : status.state === 'done' ? (
          <SegmentResult segment={status.segment} issues={status.issues} entrySceneId={status.segment.entrySceneId} />
        ) : null}
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
