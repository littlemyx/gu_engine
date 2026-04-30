import React from 'react';
import {
  ARCHETYPE_IDS,
  ARCHETYPES,
  useBriefStore,
  type ArchetypeId,
  type Brief,
  type EndingKind,
  type Format,
  type LoveInterestCard,
} from '@/narrative';
import styles from './BriefEditor.module.css';

const FORMATS: Format[] = ['single_arc', 'episodic', 'vignette'];
const ENDINGS: EndingKind[] = ['good', 'normal', 'bad'];

const csv = (a: string[]) => a.join(', ');
const fromCsv = (s: string) =>
  s
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

export const BriefEditor: React.FC<{ brief: Brief }> = ({ brief }) => {
  const store = useBriefStore();

  return (
    <div className={styles.editor}>
      <header className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>
          Бриф <span className={styles.editorMeta}>v{brief.version} · редактируемый</span>
        </h2>
        <div className={styles.editorActions}>
          <button type="button" className={styles.miniBtn} onClick={store.resetToSample}>
            Образец
          </button>
          <button type="button" className={styles.miniBtn} onClick={store.resetToBlank}>
            Пусто
          </button>
        </div>
      </header>

      {/* ── Параметры генерации ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Параметры</h3>
        <div className={styles.fieldGrid}>
          <Field label="format">
            <select
              className={styles.select}
              value={brief.format}
              onChange={e => store.setFormat(e.target.value as Format)}
            >
              {FORMATS.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="acts">
            <input
              type="number"
              className={styles.input}
              value={brief.scale.acts}
              min={1}
              max={10}
              onChange={e => store.patchScale({ acts: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="duration (мин)">
            <input
              type="number"
              className={styles.input}
              value={brief.scale.targetDurationMinutes}
              min={5}
              step={5}
              onChange={e => store.patchScale({ targetDurationMinutes: Number(e.target.value) || 30 })}
            />
          </Field>
          <Field label="branching">
            <select
              className={styles.select}
              value={brief.scale.branchingDensity}
              onChange={e =>
                store.patchScale({ branchingDensity: e.target.value as Brief['scale']['branchingDensity'] })
              }
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </Field>
          <Field label="common-route share">
            <input
              type="number"
              className={styles.input}
              value={brief.scale.commonRouteShare}
              min={0.1}
              max={0.9}
              step={0.1}
              onChange={e => store.patchScale({ commonRouteShare: Number(e.target.value) || 0.3 })}
            />
          </Field>
          <Field label="endings">
            <div className={styles.checkRow}>
              {ENDINGS.map(k => {
                const checked = brief.endingsProfile.includes(k);
                return (
                  <label key={k} className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked ? brief.endingsProfile.filter(e => e !== k) : [...brief.endingsProfile, k];
                        store.setEndingsProfile(next);
                      }}
                    />
                    {k}
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
      </section>

      {/* ── Мир ──────────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Мир</h3>
        <div className={styles.fieldGrid}>
          <Field label="era">
            <input
              type="text"
              className={styles.input}
              value={brief.world.setting.era}
              onChange={e => store.patchWorldSetting({ era: e.target.value })}
              placeholder="modern_day"
            />
          </Field>
          <Field label="place">
            <input
              type="text"
              className={styles.input}
              value={brief.world.setting.place}
              onChange={e => store.patchWorldSetting({ place: e.target.value })}
              placeholder="university"
            />
          </Field>
        </div>
        <Field label="specifics" full>
          <textarea
            className={styles.textarea}
            value={brief.world.setting.specifics}
            onChange={e => store.patchWorldSetting({ specifics: e.target.value })}
            placeholder="провинциальный универ, поздняя осень, дожди"
            rows={2}
          />
        </Field>
        <div className={styles.fieldGrid}>
          <Field label="mood">
            <input
              type="text"
              className={styles.input}
              value={brief.world.tone.mood}
              onChange={e => store.patchWorldTone({ mood: e.target.value })}
              placeholder="bittersweet"
            />
          </Field>
          <Field label="intensity">
            <input
              type="number"
              className={styles.input}
              value={brief.world.tone.intensity}
              min={0}
              max={1}
              step={0.1}
              onChange={e => store.patchWorldTone({ intensity: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <Field label="themes (через запятую)" full>
          <input
            type="text"
            className={styles.input}
            value={csv(brief.world.tone.themes)}
            onChange={e => store.patchWorldTone({ themes: fromCsv(e.target.value) })}
            placeholder="self_discovery, first_love, transitions"
          />
        </Field>
      </section>

      {/* ── Арт-стиль ────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Арт-стиль</h3>
        <Field label="reference descriptor" full>
          <input
            type="text"
            className={styles.input}
            value={brief.artStyle.referenceDescriptor}
            onChange={e => store.patchArtStyle({ referenceDescriptor: e.target.value })}
            placeholder="anime, soft pastels, painterly backgrounds"
          />
        </Field>
        <Field label="model prompt template" full>
          <textarea
            className={styles.textarea}
            value={brief.artStyle.modelPromptTemplate}
            onChange={e => store.patchArtStyle({ modelPromptTemplate: e.target.value })}
            rows={2}
          />
        </Field>
        <Field label="color palette (HEX, через запятую)" full>
          <input
            type="text"
            className={styles.input}
            value={csv(brief.artStyle.colorPalette)}
            onChange={e => store.patchArtStyle({ colorPalette: fromCsv(e.target.value) })}
            placeholder="#d8c8b6, #a4b8a2, #5a6b7c, #1f2a30"
          />
        </Field>
      </section>

      {/* ── Протагонист ──────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Протагонист (blank slate)</h3>
        <div className={styles.fieldGrid}>
          <Field label="gender">
            <select
              className={styles.select}
              value={brief.protagonist.gender}
              onChange={e => store.patchProtagonist({ gender: e.target.value as Brief['protagonist']['gender'] })}
            >
              <option value="female">female</option>
              <option value="male">male</option>
              <option value="nonbinary">nonbinary</option>
              <option value="player_choice">player_choice</option>
            </select>
          </Field>
          <Field label="voice style">
            <select
              className={styles.select}
              value={brief.protagonist.voiceStyle}
              onChange={e =>
                store.patchProtagonist({ voiceStyle: e.target.value as Brief['protagonist']['voiceStyle'] })
              }
            >
              <option value="neutral_minimal">neutral_minimal</option>
              <option value="defined">defined</option>
            </select>
          </Field>
        </div>
      </section>

      {/* ── Love interests ───────────────────────────────────────────────── */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            Love interests <span className={styles.sectionMetaInline}>{brief.loveInterests.length}</span>
          </h3>
          <button type="button" className={styles.miniBtn} onClick={store.addLoveInterest}>
            + добавить
          </button>
        </header>
        {brief.loveInterests.length === 0 && (
          <div className={styles.empty}>Нет персонажей. Добавь хотя бы одного для генерации.</div>
        )}
        {brief.loveInterests.map(li => (
          <LoveInterestEditor key={li.id} li={li} />
        ))}
      </section>
    </div>
  );
};

const LoveInterestEditor: React.FC<{ li: LoveInterestCard }> = ({ li }) => {
  const store = useBriefStore();
  const archetype = ARCHETYPES[li.archetype];
  const specificsSchema = archetype.archetypeSpecificsSchema;
  const specifics = li.archetypeSpecifics ?? {};

  return (
    <div className={styles.liCard}>
      <header className={styles.liHeader}>
        <input
          type="text"
          className={styles.liNameInput}
          value={li.name}
          onChange={e => store.patchLoveInterest(li.id, { name: e.target.value })}
          placeholder="Имя"
        />
        <input
          type="number"
          className={styles.liAgeInput}
          value={li.age}
          min={16}
          max={60}
          onChange={e => store.patchLoveInterest(li.id, { age: Number(e.target.value) || 21 })}
        />
        <select
          className={styles.select}
          value={li.archetype}
          onChange={e => store.setLoveInterestArchetype(li.id, e.target.value as ArchetypeId)}
        >
          {ARCHETYPE_IDS.map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={() => store.removeLoveInterest(li.id)}
          aria-label="Удалить"
        >
          ×
        </button>
      </header>

      <Field label="role in world" full>
        <input
          type="text"
          className={styles.input}
          value={li.roleInWorld}
          onChange={e => store.patchLoveInterest(li.id, { roleInWorld: e.target.value })}
          placeholder="староста потока"
        />
      </Field>
      <Field label="speech pattern" full>
        <input
          type="text"
          className={styles.input}
          value={li.speechPattern}
          onChange={e => store.patchLoveInterest(li.id, { speechPattern: e.target.value })}
          placeholder="формальная, резкая, редко шутит"
        />
      </Field>
      <div className={styles.fieldGrid}>
        <Field label="hair">
          <input
            type="text"
            className={styles.input}
            value={li.appearance.hair ?? ''}
            onChange={e => store.patchLoveInterestAppearance(li.id, { hair: e.target.value })}
          />
        </Field>
        <Field label="build">
          <input
            type="text"
            className={styles.input}
            value={li.appearance.build ?? ''}
            onChange={e => store.patchLoveInterestAppearance(li.id, { build: e.target.value })}
          />
        </Field>
        <Field label="signature item">
          <input
            type="text"
            className={styles.input}
            value={li.appearance.signatureItem ?? ''}
            onChange={e => store.patchLoveInterestAppearance(li.id, { signatureItem: e.target.value })}
          />
        </Field>
      </div>

      <Field label="personality (4 csv-поля: traits | values | fears | desires)" full>
        <div className={styles.personalityGrid}>
          <input
            type="text"
            className={styles.input}
            placeholder="traits"
            value={csv(li.personality.traits)}
            onChange={e => store.patchLoveInterestPersonality(li.id, { traits: fromCsv(e.target.value) })}
          />
          <input
            type="text"
            className={styles.input}
            placeholder="values"
            value={csv(li.personality.values)}
            onChange={e => store.patchLoveInterestPersonality(li.id, { values: fromCsv(e.target.value) })}
          />
          <input
            type="text"
            className={styles.input}
            placeholder="fears"
            value={csv(li.personality.fears)}
            onChange={e => store.patchLoveInterestPersonality(li.id, { fears: fromCsv(e.target.value) })}
          />
          <input
            type="text"
            className={styles.input}
            placeholder="desires"
            value={csv(li.personality.desires)}
            onChange={e => store.patchLoveInterestPersonality(li.id, { desires: fromCsv(e.target.value) })}
          />
        </div>
      </Field>

      <Field label="pre-existing relationship" full>
        <input
          type="text"
          className={styles.input}
          value={li.preExistingRelationship ?? ''}
          onChange={e =>
            store.patchLoveInterest(li.id, {
              preExistingRelationship: e.target.value || null,
            })
          }
          placeholder="antagonistic | distant_acquaintance | null"
        />
      </Field>

      {specificsSchema && (
        <div className={styles.specificsBlock}>
          <div className={styles.specificsHeader}>archetype_specifics для «{li.archetype}»</div>
          {Object.entries(specificsSchema).map(([field, decl]) => (
            <Field key={field} label={`${field}${decl.required ? ' *' : ''}`} full>
              <input
                type="text"
                className={styles.input}
                value={specifics[field] ?? ''}
                onChange={e => store.patchLoveInterestSpecifics(li.id, field, e.target.value)}
                placeholder={decl.examples.slice(0, 3).join(' | ')}
              />
            </Field>
          ))}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; full?: boolean; children: React.ReactNode }> = ({ label, full, children }) => {
  return (
    <label className={`${styles.field} ${full ? styles.fieldFull : ''}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
};
