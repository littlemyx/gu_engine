import React, { useState } from 'react';

import { applyPrefab } from '@/prefabs/applyPrefab';
import { usePrefabStore } from '@/prefabs/prefabStore';
import { PREFAB_KIND_GLYPH, PREFAB_KIND_LABEL, prefabSummary } from '@/prefabs/prefabTypes';
import ActionButton from '@/ui/ActionButton';
import PrefabCard from '@/ui/PrefabCard';
import { pluralize } from '@/ui/plural';

import { isSameSelection, useStudioStore } from '../studioStore';
import { READONLY_REASON } from '../useBreakpoint';

import styles from './panels.module.css';

import type { Prefab } from '@/prefabs/prefabTypes';

/** MIME перетаскивания: иерархия принимает только свои префабы. */
export const PREFAB_DND_TYPE = 'application/x-gu-prefab';

export interface PrefabsPanelProps {
  /** Применение префаба обесценивает хребет — предупреждаем строкой. */
  hasStory: boolean;
  /** Режим чтения: библиотеку видно, но вставлять и удалять нельзя. */
  readonly?: boolean;
  onApplied: (message: string) => void;
  /**
   * Перехват вставки: показать последствия и применить через `proceed` — или
   * не применять вовсе. Без перехвата вставка немедленная (старый шелл).
   */
  confirmApply?: (prefab: Prefab, proceed: () => void) => void;
}

/** Док «Префабы»: библиотека, переживающая проект. Карточки перетаскиваются в иерархию. */
const PrefabsPanel = ({ hasStory, readonly = false, onApplied, confirmApply }: PrefabsPanelProps) => {
  const prefabs = usePrefabStore(s => s.prefabs);
  const removePrefab = usePrefabStore(s => s.removePrefab);
  const forkPrefab = usePrefabStore(s => s.forkPrefab);
  const selection = useStudioStore(s => s.selection);
  const select = useStudioStore(s => s.select);
  const [dragging, setDragging] = useState<string | null>(null);

  const apply = (prefab: Prefab) => {
    const proceed = () => {
      const result = applyPrefab(prefab);
      onApplied(result.invalidatesStory ? `${result.message} · историю нужно перегенерировать` : result.message);
    };
    if (confirmApply) confirmApply(prefab, proceed);
    else proceed();
  };

  const selected = prefabs.find(p => selection?.kind === 'prefab' && p.id === selection.id) ?? null;

  return (
    <div className={styles.dockBody}>
      <div className={styles.dockActions}>
        <span className={styles.dockHint}>перетащите префаб в иерархию — он войдёт в текущую историю</span>
        {selected && (
          <>
            <ActionButton
              label="Вставить в каст"
              kind="outline"
              disabled={readonly}
              reason={READONLY_REASON}
              onClick={() => apply(selected)}
            />
            <ActionButton
              label="Форкнуть"
              kind="ghost"
              onClick={() => forkPrefab(selected.id, `${selected.name} v${selected.version + 1}`)}
            />
            <ActionButton
              label="Удалить из библиотеки"
              kind="ghost"
              disabled={readonly}
              reason={READONLY_REASON}
              onClick={() => {
                removePrefab(selected.id);
                select(null);
              }}
            />
          </>
        )}
      </div>

      {prefabs.length === 0 ? (
        <div className={styles.placeholder}>
          Библиотека пуста. Сохраните персонажа, мир или аудио-набор из инспектора — префаб переживёт эту историю и
          вставится в следующую.
        </div>
      ) : (
        <div className={styles.dockGrid}>
          {prefabs.map(prefab => (
            <PrefabCard
              key={prefab.id}
              glyph={PREFAB_KIND_GLYPH[prefab.kind]}
              title={`${prefab.name} v${prefab.version}`}
              kind={PREFAB_KIND_LABEL[prefab.kind]}
              src={dragging === prefab.id ? 'отпустите в иерархии' : `из «${prefab.origin}»`}
              status={
                dragging === prefab.id
                  ? '→ войдёт в историю'
                  : prefab.usedIn === 0
                  ? `не использован · ${prefabSummary(prefab)}`
                  : `в ${pluralize(prefab.usedIn, 'истории', 'историях', 'историях')} · ${prefabSummary(prefab)}`
              }
              tone={prefab.usedIn === 0 ? 'muted' : 'ok'}
              selected={isSameSelection(selection, { kind: 'prefab', id: prefab.id })}
              dragging={dragging === prefab.id}
              draggable={!readonly}
              onClick={() => select({ kind: 'prefab', id: prefab.id })}
              onDragStart={event => {
                setDragging(prefab.id);
                event.dataTransfer.setData(PREFAB_DND_TYPE, prefab.id);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              onDragEnd={() => setDragging(null)}
            />
          ))}
        </div>
      )}

      {hasStory && prefabs.length > 0 && (
        <div className={styles.dockNote}>
          История уже сгенерирована: вставка персонажа или мира её обесценит — понадобится прогон.
        </div>
      )}
    </div>
  );
};

export default PrefabsPanel;
