import React from 'react';

import { applyPrefab } from '@/prefabs/applyPrefab';
import { usePrefabStore } from '@/prefabs/prefabStore';
import { PREFAB_KIND_LABEL, prefabSummary } from '@/prefabs/prefabTypes';
import ActionButton from '@/ui/ActionButton';
import { pluralize } from '@/ui/plural';

import { useStudioStore } from '../studioStore';

import Section, { Field } from './Section';

import styles from '../panels/panels.module.css';

export interface PrefabInspectorProps {
  id: string;
  onApplied: (message: string) => void;
}

/** Инспектор префаба: что внутри, откуда пришёл и куда его можно вставить. */
const PrefabInspector = ({ id, onApplied }: PrefabInspectorProps) => {
  const prefab = usePrefabStore(s => s.prefabs.find(p => p.id === id) ?? null);
  const forkPrefab = usePrefabStore(s => s.forkPrefab);
  const removePrefab = usePrefabStore(s => s.removePrefab);
  const select = useStudioStore(s => s.select);

  if (!prefab) {
    return <div className={styles.placeholder}>Префаба нет в библиотеке.</div>;
  }

  return (
    <>
      <div>
        <div className={styles.kicker}>
          префаб · {PREFAB_KIND_LABEL[prefab.kind]} · v{prefab.version}
        </div>
        <h2 className={styles.title}>{prefab.name}</h2>
      </div>

      <Section title="Родословная">
        <Field name="откуда">{prefab.origin || '—'}</Field>
        <Field name="форк от" mono>
          {prefab.forkOf ?? '—'}
        </Field>
        <Field name="применён">
          {prefab.usedIn === 0 ? 'ни разу' : `в ${pluralize(prefab.usedIn, 'истории', 'историях', 'историях')}`}
        </Field>
      </Section>

      <Section title="Состав">
        <Field name="внутри">{prefabSummary(prefab)}</Field>
        {prefab.kind === 'character' && <Field name="персонаж">{prefab.payload.li.archetype || '—'}</Field>}
        {prefab.kind === 'world' && (
          <Field name="локации">{prefab.payload.worldModel.locations.map(l => l.name || l.id).join(' · ')}</Field>
        )}
      </Section>

      <div className={styles.actions}>
        <ActionButton
          label="Вставить в текущую историю"
          block
          onClick={() => {
            const result = applyPrefab(prefab);
            onApplied(result.invalidatesStory ? `${result.message} · историю нужно перегенерировать` : result.message);
          }}
        />
        <ActionButton
          label="Форкнуть"
          kind="outline"
          block
          onClick={() => forkPrefab(prefab.id, `${prefab.name} v${prefab.version + 1}`)}
        />
        <ActionButton
          label="Удалить из библиотеки"
          kind="outline"
          block
          onClick={() => {
            removePrefab(prefab.id);
            select(null);
          }}
        />
      </div>
    </>
  );
};

export default PrefabInspector;
