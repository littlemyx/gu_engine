import React, { useMemo } from 'react';
import {
  useNarrativeStore,
  useBriefStore,
  IMAGE_SERVER_BASE,
  topoOrderAnchors,
  type StoryOutlinePlan,
  type DialogueUnit,
} from '@/narrative';
import styles from './CharacterRelationshipPanel.module.css';

type Props = {
  outline: StoryOutlinePlan;
};

type EncounterPoint = {
  /** Якорь-этап, на котором доступна встреча (компилятор подключает её в hub локации). */
  fromId: string;
  location: string;
};

type LiRelationshipData = {
  liId: string;
  liName: string;
  spriteUrl: string | null;
  anchorsPresent: string[];
  encounters: EncounterPoint[];
  /** Диалоговые юниты encounter-а этого LI (enc_<liId> из unitProse). */
  units: DialogueUnit[];
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
  const unitProse = useNarrativeStore(s => s.unitProse);
  const characters = useNarrativeStore(s => s.characters);

  const liData = useMemo((): LiRelationshipData[] => {
    // unitProse ключуется id юнита (evt_*/enc_*) — принадлежность LI несёт
    // сам DialogueUnit.liId.
    const allUnits = Object.values(unitProse).flat();
    return brief.loveInterests.map(li => {
      // Присутствие детерминировано расписанием: адаптер кладёт LI в
      // availableLIs якорей, где персонаж на сцене.
      const anchorsWithLi = topoOrderAnchors(outline).filter(a => a.availableLIs.includes(li.id));
      const anchorsPresent = anchorsWithLi.map(a => a.id);
      const encounters: EncounterPoint[] = anchorsWithLi.map(a => ({ fromId: a.id, location: a.location }));

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
        units: allUnits.filter(u => u.liId === li.id),
      };
    });
  }, [brief.loveInterests, outline, unitProse, characters]);

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
  const totalEncounters = li.encounters.length;

  return (
    <div className={styles.liCard}>
      <div className={styles.liHeader}>
        {li.spriteUrl && <img src={li.spriteUrl} alt={li.liName} className={styles.liSprite} />}
        <div>
          <div className={styles.liName}>{li.liName}</div>
          <div className={styles.liMeta}>
            {li.anchorsPresent.length} якорей · {totalEncounters} encounter-ов · {li.units.length} диалоговых юнитов
          </div>
        </div>
      </div>

      <div className={styles.timeline}>
        {outline.anchors.map(anchor => (
          <AnchorDot
            key={anchor.id}
            anchor={anchor}
            isPresent={li.anchorsPresent.includes(anchor.id)}
            hasEncounters={li.encounters.some(e => e.fromId === anchor.id)}
          />
        ))}
      </div>

      <div className={styles.encounterRow}>
        <div className={styles.encounterLocation}>
          <span className={styles.encounterEdge}>encounter-юнит</span>
        </div>
        <div className={styles.bracketRow}>
          {(['positive', 'neutral', 'negative'] as const).map(bracket => {
            const has = li.units.some(u => u.bracket === bracket);
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

      {totalEncounters === 0 && li.units.length === 0 && (
        <div className={styles.emptyState}>Встреч нет: персонаж не попадает в расписание ни одного якоря.</div>
      )}
    </div>
  );
};

const AnchorDot: React.FC<{
  anchor: { id: string; act: number; location: string };
  isPresent: boolean;
  hasEncounters: boolean;
}> = ({ anchor, isPresent, hasEncounters }) => (
  <div className={styles.dotWrapper} title={`${anchor.id}\n${anchor.location}`}>
    <div
      className={`${styles.dot} ${
        hasEncounters ? styles.dotEncounter : isPresent ? styles.dotPresent : styles.dotAbsent
      }`}
    />
    <div className={styles.dotLabel}>{anchor.id.replace(/_/g, ' ').slice(0, 12)}</div>
  </div>
);
