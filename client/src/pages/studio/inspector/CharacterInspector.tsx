import React, { useMemo } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { IMAGE_SERVER_BASE } from '@/narrative';
import { deriveLegacyOutline } from '@/narrative/deriveLegacyOutline';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { CharacterRelationshipPanel } from '@/pages/playground/CharacterRelationshipPanel';
import ActionButton from '@/ui/ActionButton';

import { useStudioStore } from '../studioStore';

import Section, { Field } from './Section';

import styles from '../panels/panels.module.css';

export interface CharacterInspectorProps {
  id: string;
  onGenerateSprite: () => void;
  onSavePrefab: () => void;
  running: boolean;
  disabledReason?: string;
}

const BRACKET_LABEL: Record<string, string> = {
  positive: 'тепло',
  neutral: 'нейтрально',
  negative: 'холодно',
};

/** Инспектор персонажа: спрайт, присутствие в расписании, ступени и проза. */
const CharacterInspector = ({
  id,
  onGenerateSprite,
  onSavePrefab,
  running,
  disabledReason,
}: CharacterInspectorProps) => {
  const brief = useBriefStore(s => s.brief);
  const schedule = useNarrativeStore(s => s.schedule);
  const calendar = useNarrativeStore(s => s.calendar);
  const eventUnits = useNarrativeStore(s => s.eventUnits);
  const unitProse = useNarrativeStore(s => s.unitProse);
  const characters = useNarrativeStore(s => s.characters);
  const audioByLi = useNarrativeStore(s => s.audioByLi);
  const spine = useNarrativeStore(s => s.spine);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const select = useStudioStore(s => s.select);

  const li = brief.loveInterests.find(l => l.id === id);
  const sprite = characters[id];
  const spriteUrl =
    sprite?.status === 'done' && sprite.idleFilename
      ? `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(sprite.idleFilename)}`
      : null;

  const units = useMemo(() => Object.values(eventUnits).filter(u => u.participants.includes(id)), [eventUnits, id]);

  const stages = useMemo(() => {
    const byStage = new Map<number, { total: number; withProse: number }>();
    for (const unit of units) {
      const stage = unit.arcStage ?? 0;
      const entry = byStage.get(stage) ?? { total: 0, withProse: 0 };
      entry.total += 1;
      if ((unitProse[unit.id]?.length ?? 0) > 0) entry.withProse += 1;
      byStage.set(stage, entry);
    }
    return [...byStage.entries()].sort((a, b) => a[0] - b[0]);
  }, [units, unitProse]);

  const onScreen = useMemo(() => {
    const track = schedule?.[id] ?? [];
    return track.filter(Boolean).length;
  }, [schedule, id]);

  // Легаси-панель графов отношений ждёт outline — он выводится из хребта.
  const legacyOutline = useMemo(
    () => (spine && calendar ? deriveLegacyOutline(spine, calendar, schedule, brief, worldModel).outline : null),
    [spine, calendar, schedule, brief, worldModel],
  );

  const brackets = useMemo(() => {
    const seen = new Set<string>();
    for (const unit of units) for (const d of unitProse[unit.id] ?? []) seen.add(d.bracket);
    return seen;
  }, [units, unitProse]);

  if (!li) {
    return <div className={styles.placeholder}>Персонажа нет в брифе.</div>;
  }

  return (
    <>
      <div>
        <div className={styles.kicker}>персонаж · {li.archetype || 'без архетипа'}</div>
        <h2 className={styles.title}>{li.name || li.id}</h2>
        {spriteUrl && <img src={spriteUrl} alt={li.name} className={styles.portrait} />}
      </div>

      <Section title="Присутствие">
        <Field name="на сцене">{calendar ? `${onScreen} из ${calendar.slotCount} слотов` : `${onScreen} слотов`}</Field>
        <Field name="встречи">{units.length === 0 ? 'нет' : `${units.length}`}</Field>
      </Section>

      <Section title="Лестница отношений">
        {stages.length === 0 && <div className={styles.placeholder}>Ступеней пока нет.</div>}
        {stages.map(([stage, counts]) => (
          <Field key={stage} name={stage === 0 ? 'без ступени' : `ступень ${stage}`}>
            {counts.withProse}/{counts.total} с прозой
          </Field>
        ))}
        <div className={styles.chipRow}>
          {(['positive', 'neutral', 'negative'] as const).map(bracket => (
            <span key={bracket} className={styles.chip} style={brackets.has(bracket) ? undefined : { opacity: 0.4 }}>
              {BRACKET_LABEL[bracket]} {brackets.has(bracket) ? '✓' : '—'}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Медиа">
        <Field name="спрайт">
          {sprite?.status === 'done'
            ? `готов ✓${
                Object.keys(sprite.poseFilenames ?? {}).length > 0
                  ? ` · ${Object.keys(sprite.poseFilenames ?? {}).length} поз`
                  : ''
              }`
            : sprite?.status === 'failed'
            ? `✗ ${sprite.error}`
            : sprite
            ? '⟳ генерируется'
            : 'не заказан'}
        </Field>
        <Field name="аудио">
          {['positive', 'negative']
            .map(
              tone =>
                `${tone === 'positive' ? 'тепло' : 'холод'}: ${
                  audioByLi[id]?.[tone as 'positive' | 'negative']?.status === 'done' ? '✓' : '—'
                }`,
            )
            .join(' · ')}
        </Field>
      </Section>

      {units.length > 0 && (
        <Section title={`Юниты · ${units.length}`} defaultOpen={false}>
          {units.map(unit => (
            <button
              key={unit.id}
              type="button"
              className={styles.sectionHead}
              onClick={() => select({ kind: 'unit', unitId: unit.id })}
            >
              <span>›</span>
              <span>{unit.goal || unit.id}</span>
            </button>
          ))}
        </Section>
      )}

      {legacyOutline && (
        <Section title="Отношения и присутствие" defaultOpen={false}>
          {/* Легаси-панель до дизайна: таймлайн якорей и покрытие брекетов. */}
          <div className={styles.legacyLight}>
            <CharacterRelationshipPanel outline={legacyOutline} />
          </div>
        </Section>
      )}

      <div className={styles.actions}>
        <ActionButton
          label="Нарисовать спрайт"
          cost="≈ $0.04"
          block
          disabled={running || Boolean(disabledReason) || sprite?.status === 'done'}
          reason={
            disabledReason ??
            (running
              ? 'идёт генерация'
              : sprite?.status === 'done'
              ? 'спрайт готов — перерисовка всем кастом из дока «Ассеты»'
              : undefined)
          }
          onClick={onGenerateSprite}
        />
        <ActionButton label="Сохранить как префаб" kind="outline" block onClick={onSavePrefab} />
      </div>
    </>
  );
};

export default CharacterInspector;
