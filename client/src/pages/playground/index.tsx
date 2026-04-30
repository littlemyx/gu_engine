import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  SAMPLE_BRIEF,
  validateBrief,
  type ArchetypeProfile,
  type Brief,
  type LoveInterestCard,
} from '@/narrative';
import styles from './playground.module.css';

const Playground = () => {
  const [showRawBrief, setShowRawBrief] = useState(false);
  const issues = useMemo(() => validateBrief(SAMPLE_BRIEF), []);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

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

export default Playground;
