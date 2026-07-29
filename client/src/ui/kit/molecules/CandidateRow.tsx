import React from 'react';

import AccentText from '../atoms/AccentText';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './CandidateRow.module.css';

export interface CandidateRowProps {
  /** Название кандидата в списке отбора, напр. «◈ Б4 «Фестиваль» — бит хребта».
   * Проп `name` в макете переименован — там это зарезервированный атрибут
   * инструмента дизайна. */
  label: string;
  /** Итог отбора справа, напр. «победит». */
  outcome: string;
  /** Строка — текущий лидер отбора: акцентная подсветка и итог акцентным цветом. */
  winner?: boolean;
  onDark?: boolean;
  /** Ширина строки, px (200–520 в макете). */
  width?: number;
  /** Без колбэка строка нерактивна и рендерится как `<div>`. */
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/CandidateRow.dc.html` (molecules.json#p050,
 * «СТРОКА КАНДИДАТА СЕЛЕКТОРА»).
 * Строка кандидата в списке отбора салиенс-селектора: имя слева, итог справа.
 * Лидер (`winner`) получает акцентную подложку и акцентный цвет итога, прочие
 * строки — приглушённый текст с обеих сторон. Подложка и её hover/active
 * ступени (`--gu-selected-bg`/`--gu-hairline-edge` на тёмном,
 * `color-mix(... var(--color-accent) ...)` на светлом) собраны локально —
 * `SelectionHighlight` даёт только один фиксированный тинт (28% акцента) на
 * оба контекста и не подходит ни под 14%-акцент светлого, ни под белый тинт
 * тёмного (см. `missingAtoms` отчёта задачи). Приглушённый итог (`outcome`
 * без `winner`) тоже собран локально: `MutedText.quiet` синхронно приглушает
 * обе рампы (`onLight`/`onDark`) на одну ступень, а тут нужны разные ступени
 * одновременно (`--color-neutral-500` на светлом при обычном `--gu-ink-60` на
 * тёмном) — тоже в отчёте. Имя лидера идёт через `TextLabel` тоном `normal`:
 * на тёмном тот даёт `--gu-ink-85` вместо ровного `--gu-ink` макета — то же
 * приближение, что уже принято в `BranchRow`/`ArtifactRow`.
 */
const CandidateRow = ({ label, outcome, winner = true, onDark = false, width = 280, onClick }: CandidateRowProps) => {
  const interactive = Boolean(onClick);

  const rowClassName = [
    styles.root,
    winner ? styles.winner : '',
    onDark ? styles.onDark : '',
    interactive ? styles.clickable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const outcomeMutedClassName = [styles.outcomeMuted, onDark ? styles.outcomeMutedDark : ''].filter(Boolean).join(' ');

  const content = (
    <>
      <span className={styles.name}>
        {winner ? (
          <TextLabel text={label} onDark={onDark} size={11.5} />
        ) : (
          <MutedText text={label} onDark={onDark} size={11.5} />
        )}
      </span>
      <span className={styles.outcome}>
        {winner ? (
          <AccentText text={outcome} tone="accent" onDark={onDark} size={11.5} />
        ) : (
          <span className={outcomeMutedClassName}>{outcome}</span>
        )}
      </span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={rowClassName} style={{ width: `${width}px` }} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={rowClassName} style={{ width: `${width}px` }}>
      {content}
    </div>
  );
};

export default CandidateRow;
