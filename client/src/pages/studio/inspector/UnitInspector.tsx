import React from 'react';

import { formatEffect, formatGuard } from '@/narrative/events';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { slotLabel } from '@/narrative/calendarTypes';
import ActionButton from '@/ui/ActionButton';

import { useStudioProjectStore } from '../studioProjectStore';
import { useStudioStore } from '../studioStore';

import Section, { Field } from './Section';

import styles from '../panels/panels.module.css';

import type { DialogueVariantBracket } from '@/narrative/types';

export interface UnitInspectorProps {
  unitId: string;
  bracket?: DialogueVariantBracket;
  running: boolean;
}

const BRACKETS: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];

const BRACKET_LABEL: Record<DialogueVariantBracket, string> = {
  positive: 'тепло',
  neutral: 'нейтрально',
  negative: 'холодно',
};

/** Инспектор юнита: когда играет, что меняет и сколько прозы написано. */
const UnitInspector = ({ unitId, bracket, running }: UnitInspectorProps) => {
  const eventUnits = useNarrativeStore(s => s.eventUnits);
  const unitProse = useNarrativeStore(s => s.unitProse);
  const calendar = useNarrativeStore(s => s.calendar);
  const setViewportTab = useStudioStore(s => s.setViewportTab);
  const setScriptBracket = useStudioProjectStore(s => s.setScriptBracket);
  const select = useStudioStore(s => s.select);

  const unit = eventUnits[unitId];
  const prose = unitProse[unitId] ?? [];

  if (!unit) {
    return <div className={styles.placeholder}>Юнита нет в текущем пуле событий.</div>;
  }

  const window = unit.at.slot;

  return (
    <>
      <div>
        <div className={styles.kicker}>
          {unit.kind} · {unit.source}
          {unit.arcStage ? ` · ступень ${unit.arcStage}` : ''}
        </div>
        <h2 className={styles.title}>{unit.goal || unit.id}</h2>
        <div className={styles.chipRow} style={{ marginTop: 6 }}>
          <span className={styles.chip}>{unit.id}</span>
          {unit.at.locationId && <span className={styles.chip}>{unit.at.locationId}</span>}
        </div>
      </div>

      <Section title="Когда играет">
        <Field name="если" mono>
          {formatGuard(unit.guard)}
        </Field>
        <Field name="окно" mono>
          {window == null
            ? '—'
            : calendar
            ? `${slotLabel(window.fromSlot, calendar)} — ${slotLabel(window.toSlot, calendar)}`
            : `${window.fromSlot}–${window.toSlot}`}
        </Field>
        <Field name="участники">{unit.participants.join(', ') || '—'}</Field>
        <Field name="приоритет" mono>
          {String(unit.priority)}
        </Field>
      </Section>

      <Section title="Что меняет">
        <Field name="эффекты" mono>
          {unit.effects.length === 0 ? '—' : unit.effects.map(e => formatEffect(e)).join(' · ')}
        </Field>
      </Section>

      <Section title={`Проза · ${prose.length}/3`}>
        {BRACKETS.map(b => {
          const written = prose.find(p => p.bracket === b);
          const active = bracket === b;
          return (
            <button
              key={b}
              type="button"
              className={styles.sectionHead}
              disabled={!written}
              onClick={() => {
                setScriptBracket(b);
                setViewportTab('script');
                select({ kind: 'unit', unitId, bracket: b });
              }}
              title={written ? 'Открыть в сценарии' : 'Проза этой ступени не написана'}
            >
              <span>{written ? (active ? '◉' : '○') : '□'}</span>
              <span>
                {BRACKET_LABEL[b]}{' '}
                <span className={styles.mono}>{written ? `${written.nodes.length} узлов` : 'нет'}</span>
              </span>
            </button>
          );
        })}
      </Section>

      <div className={styles.actions}>
        <ActionButton
          label="Показать в сценарии"
          kind="ghost"
          block
          disabled={prose.length === 0}
          reason="прозы ещё нет"
          onClick={() => setViewportTab('script')}
        />
        <ActionButton
          label="Дописать прозу юнита"
          cost="≈ $0.05 за ступень"
          kind="outline"
          block
          disabled
          reason={running ? 'идёт прогон' : 'проза юнитов пишется прогоном целиком'}
        />
      </div>
    </>
  );
};

export default UnitInspector;
