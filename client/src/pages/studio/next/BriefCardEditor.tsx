import React from 'react';

import { ARCHETYPE_IDS, useBriefStore } from '@/narrative';
import Checkbox from '@/ui/kit/atoms/Checkbox';
import Input from '@/ui/kit/atoms/Input';

import styles from './briefZone.module.css';
import shell from './shell.module.css';
import casting from './casting.module.css';

import type { ArchetypeId, Brief, EndingKind, Format } from '@/narrative';
import type { BriefCardId } from './briefZoneModel';

const FORMATS: Format[] = ['single_arc', 'episodic', 'vignette'];
const ENDINGS: EndingKind[] = ['good', 'normal', 'bad'];

/** Пустой ввод числа — «авто» (null), а не ноль: габарит выберет генератор. */
const numOrNull = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

/** Пустое значение селекта — тоже «авто». */
const AUTO = '';

const csv = (a: string[]) => a.join(', ');
const fromCsv = (s: string) =>
  s
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

const TITLES: Record<BriefCardId, string> = {
  setting: 'Сеттинг',
  tone: 'Тон и темы',
  format: 'Формат и габариты',
  branching: 'Ветвление и концовки',
  protagonist: 'Протагонист',
  artstyle: 'Арт-стиль',
  cast: 'Каст · карточки LI',
};

export interface BriefCardEditorProps {
  card: BriefCardId;
  brief: Brief;
  onClose: () => void;
}

/**
 * Плашка правки выбранной карточки брифа. Поля — те же сторовые сеттеры, что
 * у полной формы legacy-плейграунда: обе поверхности пишут в один briefStore.
 *
 * Поля ввода намеренно нестрогие (Input кита неконтролируемый): невалидное
 * число просто не коммитится, а «авто» — это пустая строка.
 */
const BriefCardEditor = ({ card, brief, onClose }: BriefCardEditorProps) => {
  const store = useBriefStore();

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <div className={shell.kicker}>Правка · {TITLES[card]}</div>
        <button type="button" className={casting.link} onClick={onClose}>
          свернуть
        </button>
      </div>

      {card === 'setting' && (
        <>
          <Row label="эпоха (токен)">
            <Input
              value={brief.world.setting.era}
              placeholder="modern_day"
              onChange={v => store.patchWorldSetting({ era: v })}
            />
          </Row>
          <Row label="место (токен)">
            <Input
              value={brief.world.setting.place}
              placeholder="university"
              onChange={v => store.patchWorldSetting({ place: v })}
            />
          </Row>
          <Row label="конкретика мира">
            <Input
              multiline
              value={brief.world.setting.specifics}
              placeholder="провинциальный универ, поздняя осень, дожди"
              onChange={v => store.patchWorldSetting({ specifics: v })}
            />
          </Row>
        </>
      )}

      {card === 'tone' && (
        <>
          <Row label="настроение (токен)">
            <Input
              value={brief.world.tone.mood}
              placeholder="bittersweet"
              onChange={v => store.patchWorldTone({ mood: v })}
            />
          </Row>
          <Row label="темы, через запятую">
            <Input
              value={csv(brief.world.tone.themes)}
              placeholder="self_discovery, first_love"
              onChange={v => store.patchWorldTone({ themes: fromCsv(v) })}
            />
          </Row>
          <Row label="интенсивность 0–1">
            <Input
              value={brief.world.tone.intensity == null ? '' : String(brief.world.tone.intensity)}
              placeholder="авто"
              onChange={v => store.patchWorldTone({ intensity: numOrNull(v) })}
            />
          </Row>
        </>
      )}

      {card === 'format' && (
        <>
          <Row label="формат">
            <select
              className={styles.select}
              value={brief.format ?? AUTO}
              onChange={e => store.setFormat(e.target.value === AUTO ? null : (e.target.value as Format))}
            >
              <option value={AUTO}>авто</option>
              {FORMATS.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Row>
          <Row label="актов, 1–10">
            <Input
              value={brief.scale.acts == null ? '' : String(brief.scale.acts)}
              placeholder="авто"
              onChange={v => store.patchScale({ acts: numOrNull(v) })}
            />
          </Row>
          <Row label="длительность, минут">
            <Input
              value={brief.scale.targetDurationMinutes == null ? '' : String(brief.scale.targetDurationMinutes)}
              placeholder="авто"
              onChange={v => store.patchScale({ targetDurationMinutes: numOrNull(v) })}
            />
          </Row>
        </>
      )}

      {card === 'branching' && (
        <>
          <Row label="плотность ветвления">
            <select
              className={styles.select}
              value={brief.scale.branchingDensity ?? AUTO}
              onChange={e =>
                store.patchScale({
                  branchingDensity:
                    e.target.value === AUTO ? null : (e.target.value as Brief['scale']['branchingDensity']),
                })
              }
            >
              <option value={AUTO}>авто</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </Row>
          <Row label="развилок сюжета, 0–3">
            <Input
              value={brief.scale.branchPointBudget == null ? '' : String(brief.scale.branchPointBudget)}
              placeholder="авто"
              onChange={v => {
                const n = numOrNull(v);
                store.patchScale({ branchPointBudget: n === null ? null : Math.max(0, Math.min(3, Math.trunc(n))) });
              }}
            />
          </Row>
          <Row label="доля общего маршрута">
            <Input
              value={brief.scale.commonRouteShare == null ? '' : String(brief.scale.commonRouteShare)}
              placeholder="авто · 0.1–0.9"
              onChange={v => store.patchScale({ commonRouteShare: numOrNull(v) })}
            />
          </Row>
          <Row label={brief.endingsProfile.length === 0 ? 'концовки (авто)' : 'концовки'}>
            <div className={styles.checkRow}>
              {ENDINGS.map(k => {
                const checked = brief.endingsProfile.includes(k);
                return (
                  <Checkbox
                    key={k}
                    label={k}
                    checked={checked}
                    onChange={() =>
                      store.setEndingsProfile(
                        checked ? brief.endingsProfile.filter(e => e !== k) : [...brief.endingsProfile, k],
                      )
                    }
                  />
                );
              })}
            </div>
          </Row>
        </>
      )}

      {card === 'protagonist' && (
        <>
          <Row label="пол героя">
            <select
              className={styles.select}
              value={brief.protagonist.gender ?? AUTO}
              onChange={e =>
                store.patchProtagonist({
                  gender: e.target.value === AUTO ? null : (e.target.value as Brief['protagonist']['gender']),
                })
              }
            >
              <option value={AUTO}>авто</option>
              <option value="female">female</option>
              <option value="male">male</option>
              <option value="nonbinary">nonbinary</option>
              <option value="player_choice">player_choice</option>
            </select>
          </Row>
          <Row label="голос монологов">
            <select
              className={styles.select}
              value={brief.protagonist.voiceStyle ?? AUTO}
              onChange={e =>
                store.patchProtagonist({
                  voiceStyle: e.target.value === AUTO ? null : (e.target.value as Brief['protagonist']['voiceStyle']),
                })
              }
            >
              <option value={AUTO}>авто</option>
              <option value="neutral_minimal">neutral_minimal</option>
              <option value="defined">defined</option>
            </select>
          </Row>
        </>
      )}

      {card === 'artstyle' && (
        <>
          <Row label="референс, по-английски">
            <Input
              value={brief.artStyle.referenceDescriptor}
              placeholder="anime, soft pastels, painterly backgrounds"
              onChange={v => store.patchArtStyle({ referenceDescriptor: v })}
            />
          </Row>
          <Row label="шаблон промпта фона">
            <Input
              multiline
              value={brief.artStyle.modelPromptTemplate}
              placeholder="soft anime painterly, {scene_focus}"
              onChange={v => store.patchArtStyle({ modelPromptTemplate: v })}
            />
          </Row>
          <Row label="палитра, hex через запятую">
            <Input
              value={csv(brief.artStyle.colorPalette)}
              placeholder="#d8c8b6, #a4b8a2, #5a6b7c"
              onChange={v => store.patchArtStyle({ colorPalette: fromCsv(v) })}
            />
          </Row>
        </>
      )}

      {card === 'cast' && (
        <>
          {brief.loveInterests.length === 0 && (
            <p className={styles.footnote}>Персонажей пока нет — добавьте руками или оставьте пробел генератору.</p>
          )}
          {brief.loveInterests.map(li => (
            <div key={li.id} className={styles.liRow}>
              <Input value={li.name} placeholder="имя" onChange={v => store.patchLoveInterest(li.id, { name: v })} />
              <Input
                value={String(li.age)}
                placeholder="21"
                onChange={v => {
                  const n = numOrNull(v);
                  if (n !== null) store.patchLoveInterest(li.id, { age: Math.trunc(n) });
                }}
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
              <button type="button" className={casting.link} onClick={() => store.removeLoveInterest(li.id)}>
                убрать
              </button>
            </div>
          ))}
          <div>
            <button type="button" className={casting.link} onClick={store.addLoveInterest}>
              + добавить персонажа
            </button>
          </div>
          <p className={styles.footnote}>
            Детали карточки — внешность, речь, характер — дозаполнит генератор брифа; роли закрываются на кастинг-столе
            ниже.
          </p>
        </>
      )}
    </div>
  );
};

// div, а не label: в строке концовок живут собственные label-ы чекбоксов,
// и вложенный label был бы невалидным HTML.
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className={styles.fieldRow}>
    <span className={styles.fieldLabel}>{label}</span>
    {children}
  </div>
);

export default BriefCardEditor;
