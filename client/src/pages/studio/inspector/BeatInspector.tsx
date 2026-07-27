import React from 'react';

import { formatGuard } from '@/narrative/events';
import ActionButton from '@/ui/ActionButton';

import { useStudioProjectStore } from '../studioProjectStore';

import Section, { Field } from './Section';

import styles from '../panels/panels.module.css';

import type { BlueprintNode } from '../derive/blueprintModel';
import type { ImageGenState } from '@/narrative/narrativeStore';
import type { AnchorBeat } from '@/narrative/types';

export interface BeatInspectorProps {
  node: BlueprintNode;
  prose: AnchorBeat | undefined;
  locationName: string;
  image: ImageGenState | undefined;
  /** Прогон идёт: догенерация недоступна, кнопка объясняет почему. */
  running: boolean;
  onGenerateProse?: () => void;
}

const IMAGE_LABEL: Record<ImageGenState['status'], string> = {
  pending: 'в очереди',
  generating: '⟳ генерируется',
  done: 'готов ✓',
  failed: '✗ ошибка',
};

/** Инспектор бита: замки, исходы, медиа — как в каноническом экране 4a. */
const BeatInspector = ({ node, prose, locationName, image, running, onGenerateProse }: BeatInspectorProps) => {
  const branchAssignment = useStudioProjectStore(s => s.branchAssignment);
  const setBranch = useStudioProjectStore(s => s.setBranch);
  const { beat } = node;

  return (
    <>
      <div>
        <div className={styles.kicker}>{node.kicker}</div>
        <h2 className={styles.title}>{beat.summary || beat.id}</h2>
        <div className={styles.chipRow} style={{ marginTop: 6 }}>
          <span className={styles.chip}>{beat.kind}</span>
          {/* Акты нумеруются с единицы и в календаре, и в хребте. */}
          <span className={styles.chip}>акт {node.act}</span>
          <span className={styles.chip}>{locationName}</span>
        </div>
      </div>

      <Section title="Замки">
        <Field name="guard" mono>
          {formatGuard(beat.guard)}
        </Field>
        <Field name="ставит">
          {beat.establishes.length === 0 ? '—' : beat.establishes.map(f => `+${f}`).join(' · ')}
        </Field>
        <Field name="окно" mono>
          {`${beat.window.fromSlot}–${beat.window.toSlot}`}
        </Field>
        <Field name="участники">{beat.participants.join(', ') || '—'}</Field>
        {node.dimmed && (
          <div className={styles.issue}>
            Бит недостижим при выбранных ветках — снимите выбор в развилке, чтобы увидеть его.
          </div>
        )}
      </Section>

      {beat.outcomes && beat.outcomes.length > 0 && (
        <Section title="Исходы">
          {beat.outcomes.map(outcome => {
            const active = branchAssignment[beat.id] === outcome.id;
            return (
              <button
                key={outcome.id}
                type="button"
                className={styles.sectionHead}
                onClick={() => setBranch(beat.id, active ? null : outcome.id)}
                title="Показать чертёж только по этой ветке"
              >
                <span>{active ? '◉' : '○'}</span>
                <span>
                  {outcome.label} <span className={styles.mono}>+{outcome.setsFlag}</span>
                </span>
              </button>
            );
          })}
        </Section>
      )}

      <Section title="Медиа">
        <Field name="проза">{prose ? 'есть ✓' : '▨ нет прозы'}</Field>
        <Field name="фон">{image ? IMAGE_LABEL[image.status] : 'не заказан'}</Field>
        {prose && (
          <Field name="переходы">
            {prose.transitions.length === 0 ? '—' : prose.transitions.map(t => t.label).join(' · ')}
          </Field>
        )}
      </Section>

      {node.issues.length > 0 && (
        <Section title={`Проблемы · ${node.issues.length}`}>
          {node.issues.map((issue, index) => (
            <div
              key={`${issue.scope}-${index}`}
              className={issue.severity === 'error' ? styles.issue : styles.issueWarning}
            >
              {issue.severity === 'error' ? '✗' : '·'} {issue.message}
            </div>
          ))}
        </Section>
      )}

      <div className={styles.actions}>
        <ActionButton
          label={prose ? 'Перегенерировать прозу' : 'Догенерировать прозу'}
          cost="≈ $0.04"
          kind={prose ? 'outline' : 'primary'}
          block
          disabled={running || !onGenerateProse}
          reason={running ? 'идёт прогон' : 'запуск доступен из тулбара'}
          onClick={onGenerateProse}
        />
      </div>
    </>
  );
};

export default BeatInspector;
