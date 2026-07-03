import React, { useMemo } from 'react';
import {
  useNarrativeStore,
  useBriefStore,
  IMAGE_SERVER_BASE,
  topoOrderAnchors,
  type StoryOutlinePlan,
  type DialogueVariant,
} from '@/narrative';
import styles from './CharacterRelationshipPanel.module.css';

type Props = {
  outline: StoryOutlinePlan;
};

type EncounterPoint = {
  /** Якорь-этап, на котором доступна встреча (компилятор мира подключает её в hub локации). */
  fromId: string;
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
  const dialogueVariants = useNarrativeStore(s => s.dialogueVariants);
  const characters = useNarrativeStore(s => s.characters);

  const liData = useMemo((): LiRelationshipData[] => {
    return brief.loveInterests.map(li => {
      // Встречи детерминированы: компилятор мира подключает encounter для
      // каждой пары (якорь, LI из availableLIs) — в топо-порядке сюжета.
      const anchorsWithLi = topoOrderAnchors(outline).filter(a => a.availableLIs.includes(li.id));
      const anchorsPresent = anchorsWithLi.map(a => a.id);
      const encounters: EncounterPoint[] = anchorsWithLi.map(a => ({ fromId: a.id, location: a.location }));

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
  }, [brief.loveInterests, outline, dialogueVariants, characters]);

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
        <div className={styles.emptyState}>Встреч нет: персонаж не указан в availableLIs ни одного якоря.</div>
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
      <span className={styles.encounterEdge}>{enc.fromId}</span>
      {enc.location && <span className={styles.encounterPlace}>{enc.location}</span>}
    </div>
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
