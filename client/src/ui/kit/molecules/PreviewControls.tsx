import React from 'react';

import DisclosureArrow from '../atoms/DisclosureArrow';
import Glyph from '../atoms/Glyph';
import MonoText from '../atoms/MonoText';
import OutlineButton from '../atoms/OutlineButton';

import styles from './PreviewControls.module.css';

export interface PreviewControlsProps {
  /** Подпись кнопки перезапуска сцены с промоткой. */
  restartLabel?: string;
  /** Имя текущей ветки/арки. */
  branch?: string;
  /** Значение сида — печатается моноширинным шрифтом. */
  seed?: string;
  /** Подпись кнопки переролла. */
  rerollLabel?: string;
  /** Гасит все три контрола разом — идёт прогон, превью недоступно. */
  disabled?: boolean;
  onRestart?: () => void;
  onBranch?: () => void;
  onReroll?: () => void;
}

/**
 * Порт `design_ref/components/PreviewControls.dc.html` (molecules.json#k059, «КОНТРОЛЫ ПРЕВЬЮ»).
 * Строка контролов над превью сцены: перезапуск с промоткой, переключатель
 * ветки и переролл сида. Живёт только на тёмном хроме студии — как и
 * `RunControls`, контекста «на светлом» у исходника нет. Кнопка ветки и чип
 * сида — собственная разметка вокруг атомов (`DisclosureArrow`, `MonoText`):
 * `OutlineButton` не даёт слота под вложенный глиф, а сид — не кнопка вовсе.
 */
const PreviewControls = ({
  restartLabel = 'Перезапуск с промоткой',
  branch = 'примирение',
  seed = '12345',
  rerollLabel = 'переролл',
  disabled = false,
  onRestart,
  onBranch,
  onReroll,
}: PreviewControlsProps) => {
  const restartContent = (
    <>
      <Glyph glyph="⟲" onDark size={12} />
      {restartLabel}
    </>
  );

  const branchContent = (
    <>
      ветка: {branch}
      <span className={styles.branchArrow}>
        <DisclosureArrow expanded size={9} onDark />
      </span>
    </>
  );

  return (
    <div className={styles.root}>
      {onRestart ? (
        <button type="button" className={styles.restart} disabled={disabled} onClick={onRestart}>
          {restartContent}
        </button>
      ) : (
        <span className={styles.restart} aria-disabled={disabled || undefined}>
          {restartContent}
        </span>
      )}

      {onBranch ? (
        <button type="button" className={styles.branch} disabled={disabled} onClick={onBranch}>
          {branchContent}
        </button>
      ) : (
        <span className={styles.branch} aria-disabled={disabled || undefined}>
          {branchContent}
        </span>
      )}

      <span className={styles.seed}>
        <MonoText text={`seed ${seed}`} onDark size={11.5} />
      </span>

      <OutlineButton label={rerollLabel} tone="neutral" size="compact" onDark disabled={disabled} onClick={onReroll} />
    </div>
  );
};

export default PreviewControls;
