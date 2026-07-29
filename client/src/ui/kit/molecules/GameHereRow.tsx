import React from 'react';

import AccentText from '../atoms/AccentText';
import Glyph from '../atoms/Glyph';
import SelectionHighlight from '../atoms/SelectionHighlight';

import styles from './GameHereRow.module.css';

export interface GameHereRowProps {
  /** Ведущий символ-иконка бита, напр. «◈». */
  glyph: string;
  /** Подпись бита, напр. «Б3 Шторм». */
  label: string;
  /** Подсказка рядом с кнопкой «играть отсюда»; видна только при `active`. */
  hint: string;
  /** Это и есть текущая точка «игра здесь»: подсветка строки, жирная подпись, подсказка и кнопка воспроизведения. */
  active?: boolean;
  /** Запустить игру с этого бита. Без колбэка кнопка неинтерактивна. */
  onPlay?: () => void;
}

/**
 * Порт `design_ref/components/GameHereRow.dc.html` (molecules.json#k060,
 * «СТРОКА БИТА · «ИГРА ЗДЕСЬ»»).
 * Строка бита в партитуре: где сейчас стоит точка воспроизведения. У
 * исходника нет пропа `context` — строка всегда живёт на тёмном хроме,
 * поэтому `onDark` здесь не нужен (тот же вывод, что в
 * `ArtifactRow`/`HierarchyRow`/`BranchRow`). Подпись собрана локально, а не
 * атомом `TextLabel`: его единственный тон `onDark` даёт лишь `--gu-ink-85`,
 * а активной строке макет просит ещё жирный полнояркий `--gu-ink` — то же
 * приближение, что уже решено в `HierarchyRow` (не разница на глаз, а
 * буквально другой токен). Кнопка «играть отсюда» тоже собрана локально, а
 * не атомом `IconButton`: его тон `neutral` на тёмном хроме — блёклый
 * `--gu-ink-60` с hover/active 0.07/0.14, а макет просит кнопку в полную
 * яркость чернил с более контрастными hover/active 0.12/0.2 — тона для
 * такого варианта у `IconButton` нет.
 */
const GameHereRow = ({ glyph, label, hint, active = true, onPlay }: GameHereRowProps) => {
  const labelClassName = [styles.label, active ? styles.labelActive : ''].filter(Boolean).join(' ');

  const row = (
    <div className={styles.row}>
      <Glyph glyph={glyph} tone="info" onDark size={11} />
      <span className={labelClassName}>{label}</span>
      {active && (
        <>
          <span className={styles.hint}>
            <AccentText text={hint} tone="info" onDark size={9.5} />
          </span>
          {onPlay ? (
            <button
              type="button"
              className={styles.play}
              title="играть отсюда"
              aria-label="играть отсюда"
              onClick={onPlay}
            >
              ▶
            </button>
          ) : (
            <span className={styles.play} title="играть отсюда" aria-label="играть отсюда">
              ▶
            </span>
          )}
        </>
      )}
    </div>
  );

  if (!active) return row;

  return (
    <SelectionHighlight variant="row" onDark padding={0}>
      {row}
    </SelectionHighlight>
  );
};

export default GameHereRow;
