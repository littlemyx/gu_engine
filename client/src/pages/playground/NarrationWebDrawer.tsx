import React, { useMemo } from 'react';
import {
  useNarrativeStore,
  useBriefStore,
  type StoryAnchor,
  type StoryOutlinePlan,
  type NarrationWebScene,
  type DialogueVariant,
} from '@/narrative';
import styles from './SegmentDrawer.module.css';

type Props = {
  outline: StoryOutlinePlan;
  fromId: string;
  toId: string;
  onClose: () => void;
};

const BRACKET_LABEL: Record<string, string> = {
  positive: 'warm',
  neutral: 'neutral',
  negative: 'cold',
};

const BRACKET_COLOR: Record<string, string> = {
  positive: '#16a34a',
  neutral: '#6b7280',
  negative: '#dc2626',
};

export const NarrationWebDrawer: React.FC<Props> = ({ outline, fromId, toId, onClose }) => {
  const segKey = `${fromId}->${toId}`;
  const web = useNarrativeStore(s => s.narrationWebs[segKey]);
  const dialogueVariants = useNarrativeStore(s => s.dialogueVariants);
  const brief = useBriefStore(s => s.brief);

  const fromAnchor = outline.anchors.find(a => a.id === fromId);
  const toAnchor = outline.anchors.find(a => a.id === toId);

  const encounters = useMemo(() => {
    if (!web) return [];
    const result: { sceneId: string; choiceId: string; choiceText: string; liId: string; liName: string }[] = [];
    for (const scene of web.scenes) {
      for (const choice of scene.choices) {
        if (choice.encounterTrigger) {
          const li = brief.loveInterests.find(l => l.id === choice.encounterTrigger);
          result.push({
            sceneId: scene.id,
            choiceId: choice.id,
            choiceText: choice.text,
            liId: choice.encounterTrigger,
            liName: li?.name ?? choice.encounterTrigger,
          });
        }
      }
    }
    return result;
  }, [web, brief.loveInterests]);

  return (
    <aside className={styles.drawer}>
      <header className={styles.drawerHeader}>
        <div className={styles.drawerTitleRow}>
          <h3 className={styles.drawerTitle}>Narration Web</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="close">
            ×
          </button>
        </div>
        <div className={styles.anchorPair}>
          <AnchorMini anchor={fromAnchor} id={fromId} />
          <span className={styles.arrow}>→</span>
          <AnchorMini anchor={toAnchor} id={toId} />
        </div>
      </header>

      <div className={styles.drawerBody}>
        {!web ? (
          <div className={styles.placeholder}>
            Narration web для этого ребра ещё не сгенерирован.
            <br />
            <br />
            Нажми <strong>«Сгенерировать всё»</strong> в Bulk Story Generation.
          </div>
        ) : (
          <>
            {/* ── Encounters summary ── */}
            {encounters.length > 0 && (
              <section style={{ marginBottom: 16 }}>
                <SectionLabel>Encounter-триггеры ({encounters.length})</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {encounters.map(enc => {
                    const varKey = `${fromId}:${enc.liId}`;
                    const variants = dialogueVariants[varKey] ?? [];
                    return <EncounterCard key={`${enc.sceneId}:${enc.choiceId}`} enc={enc} variants={variants} />;
                  })}
                </div>
              </section>
            )}

            {/* ── Scenes ── */}
            <SectionLabel>Сцены ({web.scenes.length})</SectionLabel>
            <div className={styles.scenesList}>
              {web.scenes.map(scene => (
                <WebSceneCard key={scene.id} scene={scene} isEntry={scene.id === web.entrySceneId} />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 600,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: 8,
    }}
  >
    {children}
  </div>
);

const AnchorMini: React.FC<{ anchor?: StoryAnchor; id: string }> = ({ anchor, id }) => (
  <div className={styles.anchorMini}>
    <span className={styles.anchorMiniId}>{id}</span>
    {anchor && (
      <span className={styles.anchorMiniType}>
        {anchor.type} · {anchor.location}
      </span>
    )}
  </div>
);

const EncounterCard: React.FC<{
  enc: { sceneId: string; choiceText: string; liId: string; liName: string };
  variants: DialogueVariant[];
}> = ({ enc, variants }) => {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        padding: '8px 10px',
        background: '#f9fafb',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
            fontSize: 12,
            fontWeight: 600,
            color: '#4f46e5',
          }}
        >
          {enc.liName}
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>@ {enc.sceneId}</span>
      </div>
      <div style={{ fontSize: 11, color: '#374151', marginBottom: 6 }}>«{enc.choiceText}»</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['positive', 'neutral', 'negative'] as const).map(bracket => {
          const has = variants.some(v => v.bracket === bracket);
          return (
            <span
              key={bracket}
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 3,
                border: `1px solid ${has ? BRACKET_COLOR[bracket] : '#d1d5db'}`,
                color: has ? BRACKET_COLOR[bracket] : '#9ca3af',
                background: has ? '#fff' : '#f3f4f6',
                fontWeight: has ? 600 : 400,
              }}
            >
              {BRACKET_LABEL[bracket]}
              {has && ` ✓`}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const WebSceneCard: React.FC<{
  scene: NarrationWebScene;
  isEntry: boolean;
}> = ({ scene, isEntry }) => {
  return (
    <div className={`${styles.sceneCard} ${isEntry ? styles.sceneCardEntry : ''}`}>
      <div className={styles.sceneHeader}>
        <span className={styles.sceneId}>{scene.id}</span>
        {isEntry && <span className={styles.entryBadge}>entry</span>}
      </div>

      {scene.location && <div className={styles.sceneMeta}>{scene.location}</div>}

      <p className={styles.narration}>{scene.narration}</p>

      {scene.choices.length > 0 && (
        <div className={styles.choices}>
          {scene.choices.map(choice => (
            <div key={choice.id} className={styles.choice}>
              <div className={styles.choiceText}>{choice.text}</div>
              <div className={styles.choiceMeta}>
                {choice.encounterTrigger && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: '#eef2ff',
                      color: '#4f46e5',
                      fontWeight: 600,
                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                    }}
                  >
                    encounter: {choice.encounterTrigger}
                  </span>
                )}
                {choice.effects?.flagSet?.map(f => (
                  <span key={f} className={styles.flagSet}>
                    +{f}
                  </span>
                ))}
                {choice.nextSceneId && <span className={styles.next}>→ {choice.nextSceneId}</span>}
                {!choice.nextSceneId && !choice.encounterTrigger && <span className={styles.next}>→ exit</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {scene.choices.length === 0 && (
        <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>click to continue →</div>
      )}
    </div>
  );
};
