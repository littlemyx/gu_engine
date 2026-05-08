import React, { useMemo } from 'react';
import {
  useNarrativeStore,
  useBriefStore,
  IMAGE_SERVER_BASE,
  type StoryOutlinePlan,
  type DialogueVariant,
} from '@/narrative';
import styles from './CharacterRelationshipPanel.module.css';

type Props = {
  outline: StoryOutlinePlan;
};

type EncounterPoint = {
  fromId: string;
  toId: string;
  sceneId: string;
  choiceText: string;
  location: string;
};

type LiRelationshipData = {
  liId: string;
  liName: string;
  spriteUrl: string | null;
  anchorsPresent: string[];
  encounters: EncounterPoint[];
  variants: Record<string, DialogueVariant[]>;
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

export const CharacterRelationshipPanel: React.FC<Props> = ({ outline }) => {
  const brief = useBriefStore(s => s.brief);
  const narrationWebs = useNarrativeStore(s => s.narrationWebs);
  const dialogueVariants = useNarrativeStore(s => s.dialogueVariants);
  const characters = useNarrativeStore(s => s.characters);

  const liData = useMemo((): LiRelationshipData[] => {
    return brief.loveInterests.map(li => {
      const anchorsPresent = outline.anchors.filter(a => a.availableLIs.includes(li.id)).map(a => a.id);

      const encounters: EncounterPoint[] = [];
      for (const [segKey, web] of Object.entries(narrationWebs)) {
        for (const scene of web.scenes) {
          for (const choice of scene.choices) {
            if (choice.encounterTrigger === li.id) {
              const [fromId, toId] = segKey.split('->');
              const fromAnchor = outline.anchors.find(a => a.id === fromId);
              encounters.push({
                fromId,
                toId,
                sceneId: scene.id,
                choiceText: choice.text,
                location: scene.location || fromAnchor?.location || '',
              });
            }
          }
        }
      }

      const variants: Record<string, DialogueVariant[]> = {};
      for (const [key, dvs] of Object.entries(dialogueVariants)) {
        if (key.endsWith(`:${li.id}`)) {
          variants[key] = dvs;
        }
      }

      const charState = characters[li.id];
      const spriteUrl =
        charState?.status === 'done' && charState.idleFilename
          ? `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(charState.idleFilename)}`
          : null;

      return {
        liId: li.id,
        liName: li.name,
        spriteUrl,
        anchorsPresent,
        encounters,
        variants,
      };
    });
  }, [brief.loveInterests, outline.anchors, narrationWebs, dialogueVariants, characters]);

  if (liData.length === 0) return null;

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>Графы отношений с персонажами</h3>
      <div className={styles.liGrid}>
        {liData.map(li => (
          <LiCard key={li.liId} li={li} outline={outline} />
        ))}
      </div>
    </section>
  );
};

const LiCard: React.FC<{ li: LiRelationshipData; outline: StoryOutlinePlan }> = ({ li, outline }) => {
  const totalVariants = Object.values(li.variants).reduce((s, v) => s + v.length, 0);
  const totalEncounters = li.encounters.length;

  return (
    <div className={styles.liCard}>
      <div className={styles.liHeader}>
        {li.spriteUrl && <img src={li.spriteUrl} alt={li.liName} className={styles.liSprite} />}
        <div>
          <div className={styles.liName}>{li.liName}</div>
          <div className={styles.liMeta}>
            {li.anchorsPresent.length} якорей · {totalEncounters} encounter-ов · {totalVariants} вариантов
          </div>
        </div>
      </div>

      <div className={styles.timeline}>
        {outline.anchors.map(anchor => {
          const isPresent = li.anchorsPresent.includes(anchor.id);
          const anchorEncounters = li.encounters.filter(e => e.fromId === anchor.id);
          return (
            <AnchorDot
              key={anchor.id}
              anchor={anchor}
              isPresent={isPresent}
              encounters={anchorEncounters}
              variants={li.variants}
              fromId={anchor.id}
              liId={li.liId}
            />
          );
        })}
      </div>

      {totalEncounters > 0 && (
        <div className={styles.encounterList}>
          {li.encounters.map((enc, i) => (
            <EncounterRow key={i} enc={enc} variants={li.variants[`${enc.fromId}:${li.liId}`] ?? []} />
          ))}
        </div>
      )}

      {totalEncounters === 0 && Object.keys(li.variants).length === 0 && (
        <div className={styles.emptyState}>Encounter-ов пока нет. Сгенерируй narration web-ы.</div>
      )}
    </div>
  );
};

const AnchorDot: React.FC<{
  anchor: { id: string; act: number; location: string };
  isPresent: boolean;
  encounters: EncounterPoint[];
  variants: Record<string, DialogueVariant[]>;
  fromId: string;
  liId: string;
}> = ({ anchor, isPresent, encounters, variants, fromId, liId }) => {
  const hasEncounters = encounters.length > 0;
  const varKey = `${fromId}:${liId}`;
  const dvs = variants[varKey] ?? [];
  const hasAllBrackets = dvs.length >= 3;

  return (
    <div className={styles.dotWrapper} title={`${anchor.id}\n${anchor.location}`}>
      <div
        className={`${styles.dot} ${
          hasEncounters
            ? hasAllBrackets
              ? styles.dotComplete
              : styles.dotEncounter
            : isPresent
            ? styles.dotPresent
            : styles.dotAbsent
        }`}
      />
      {hasEncounters && (
        <div className={styles.dotBrackets}>
          {(['positive', 'neutral', 'negative'] as const).map(b => {
            const has = dvs.some(v => v.bracket === b);
            return (
              <span
                key={b}
                className={styles.microBadge}
                style={{
                  background: has ? BRACKET_COLOR[b] : '#e5e7eb',
                  opacity: has ? 1 : 0.4,
                }}
                title={`${BRACKET_LABEL[b]}${has ? ' ✓' : ''}`}
              />
            );
          })}
        </div>
      )}
      <div className={styles.dotLabel}>{anchor.id.replace(/_/g, ' ').slice(0, 12)}</div>
    </div>
  );
};

const EncounterRow: React.FC<{
  enc: EncounterPoint;
  variants: DialogueVariant[];
}> = ({ enc, variants }) => (
  <div className={styles.encounterRow}>
    <div className={styles.encounterLocation}>
      <span className={styles.encounterEdge}>
        {enc.fromId} → {enc.toId}
      </span>
      {enc.location && <span className={styles.encounterPlace}>{enc.location}</span>}
    </div>
    <div className={styles.encounterChoice}>«{enc.choiceText}»</div>
    <div className={styles.bracketRow}>
      {(['positive', 'neutral', 'negative'] as const).map(bracket => {
        const has = variants.some(v => v.bracket === bracket);
        return (
          <span
            key={bracket}
            className={styles.bracketBadge}
            style={{
              borderColor: has ? BRACKET_COLOR[bracket] : '#d1d5db',
              color: has ? BRACKET_COLOR[bracket] : '#9ca3af',
              fontWeight: has ? 600 : 400,
            }}
          >
            {BRACKET_LABEL[bracket]}
            {has && ' ✓'}
          </span>
        );
      })}
    </div>
  </div>
);
