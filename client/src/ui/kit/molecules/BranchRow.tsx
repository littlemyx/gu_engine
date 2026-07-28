import React from 'react';

import Glyph from '../atoms/Glyph';
import TextLabel from '../atoms/TextLabel';

import styles from './BranchRow.module.css';

export interface BranchRowProps {
  /** Имя ветки, напр. «Примирение». */
  branch: string;
  /** Доля прохождений через эту ветку, 0–100. */
  percent: number;
  /** Открыть ветку. Без колбэка строка нерактивна. */
  onOpen?: (branch: string) => void;
}

/**
 * Порт `design_ref/components/BranchRow.dc.html` (molecules.json#k009,
 * «СТРОКА ВЕТКИ»).
 * Строка выбора ветки в панели истории: стрелка-разветвление и подпись
 * «ветка «имя» · N%», собранная из типизированных `branch`/`percent` (как и в
 * исходном `renderVals`). У исходника нет пропа `context` — строка всегда
 * живёт на тёмном хроме, поэтому `onDark` здесь не нужен (тот же вывод, что
 * в `ArtifactRow`/`HierarchyRow`). Целевой цвет подписи в макете —
 * `rgba(242,242,243,.7)`; ближайший тон `TextLabel` (`onDark`) даёт `.85` —
 * то же приближение, что уже принято в `ArtifactRow` (там макет просил `.75`).
 */
const BranchRow = ({ branch, percent, onOpen }: BranchRowProps) => {
  const label = `ветка «${branch}» · ${percent}%`;
  const interactive = Boolean(onOpen);

  const content = (
    <>
      <Glyph glyph="⇉" tone="muted" onDark size={10} />
      <TextLabel text={label} onDark size={11} />
    </>
  );

  const rowClassName = [styles.root, interactive ? styles.clickable : ''].filter(Boolean).join(' ');

  if (interactive) {
    return (
      <button type="button" className={rowClassName} onClick={() => onOpen?.(branch)}>
        {content}
      </button>
    );
  }

  return <div className={rowClassName}>{content}</div>;
};

export default BranchRow;
