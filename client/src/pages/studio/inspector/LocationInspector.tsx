import React, { useMemo } from 'react';

import { IMAGE_SERVER_BASE } from '@/narrative';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { LOCATION_MOOD_LABELS, SPECIAL_AMBIENT_KIND_LABELS } from '@/narrative/types';
import ActionButton from '@/ui/ActionButton';

import { useStudioStore } from '../studioStore';

import Section, { Field } from './Section';

import styles from '../panels/panels.module.css';

export interface LocationInspectorProps {
  id: string;
  onGenerateBackground: () => void;
  onSavePrefab: () => void;
  running: boolean;
  disabledReason?: string;
}

/** Инспектор локации: описание, соседи, кто бывает, что здесь играется. */
const LocationInspector = ({
  id,
  onGenerateBackground,
  onSavePrefab,
  running,
  disabledReason,
}: LocationInspectorProps) => {
  const worldModel = useNarrativeStore(s => s.worldModel);
  const images = useNarrativeStore(s => s.images);
  const spine = useNarrativeStore(s => s.spine);
  const eventUnits = useNarrativeStore(s => s.eventUnits);
  const schedule = useNarrativeStore(s => s.schedule);
  const select = useStudioStore(s => s.select);

  const location = worldModel?.locations.find(l => l.id === id) ?? null;
  const image = images[`loc:${id}`];
  const imageUrl =
    image?.status === 'done' && image.filename
      ? `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(image.filename)}`
      : null;

  const beats = useMemo(() => (spine?.beats ?? []).filter(b => b.locationId === id), [spine, id]);
  const units = useMemo(() => Object.values(eventUnits).filter(u => u.at.locationId === id), [eventUnits, id]);
  const visitors = useMemo(() => {
    const out: string[] = [];
    for (const [charId, track] of Object.entries(schedule ?? {})) {
      const slots = (track ?? []).filter(loc => loc === id).length;
      if (slots > 0) out.push(`${charId} · ${slots}`);
    }
    return out;
  }, [schedule, id]);

  if (!location) {
    return <div className={styles.placeholder}>Локации нет в модели мира.</div>;
  }

  return (
    <>
      <div>
        <div className={styles.kicker}>локация · {location.id}</div>
        <h2 className={styles.title}>{location.name || location.id}</h2>
        {imageUrl && <img src={imageUrl} alt={location.name} className={styles.portrait} />}
      </div>

      <Section title="Мир">
        <Field name="описание">{location.description || '—'}</Field>
        <Field name="точки">{location.pointsOfInterest.join(' · ') || '—'}</Field>
        <Field name="настроение">
          {LOCATION_MOOD_LABELS[location.mood] ?? location.mood}
          {location.specialKind
            ? ` · ${SPECIAL_AMBIENT_KIND_LABELS[location.specialKind] ?? location.specialKind}`
            : ''}
        </Field>
      </Section>

      <Section title={`Переходы · ${location.adjacent.length}`}>
        {location.adjacent.length === 0 && (
          <div className={styles.issue}>
            Локация без переходов: игрок сюда не дойдёт, сколько бы сцен здесь ни стояло.
          </div>
        )}
        {location.adjacent.map(adjacent => (
          <button
            key={adjacent.locationId}
            type="button"
            className={styles.sectionHead}
            onClick={() => select({ kind: 'location', id: adjacent.locationId })}
          >
            <span>→</span>
            <span>
              {adjacent.locationId} <span className={styles.mono}>{adjacent.via}</span>
            </span>
          </button>
        ))}
      </Section>

      <Section title="Кто бывает">
        {visitors.length === 0 ? (
          <div className={styles.placeholder}>По расписанию сюда никто не заходит.</div>
        ) : (
          visitors.map(v => (
            <Field key={v} name={v.split(' · ')[0]}>
              {v.split(' · ')[1]} слотов
            </Field>
          ))
        )}
      </Section>

      <Section title={`Сцены здесь · ${beats.length + units.length}`} defaultOpen={false}>
        {beats.map(beat => (
          <button
            key={beat.id}
            type="button"
            className={styles.sectionHead}
            onClick={() => select({ kind: 'beat', id: beat.id })}
          >
            <span>◈</span>
            <span>{beat.summary || beat.id}</span>
          </button>
        ))}
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

      <div className={styles.actions}>
        <ActionButton
          label={image?.status === 'done' ? 'Перерисовать фон' : 'Нарисовать фон'}
          cost="≈ $0.03"
          kind={image?.status === 'done' ? 'outline' : 'primary'}
          block
          disabled={running || Boolean(disabledReason)}
          reason={disabledReason ?? (running ? 'идёт генерация' : undefined)}
          onClick={onGenerateBackground}
        />
        <ActionButton label="Мир → префаб" kind="outline" block onClick={onSavePrefab} />
      </div>
    </>
  );
};

export default LocationInspector;
