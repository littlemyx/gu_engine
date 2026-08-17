import React from 'react';

import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';
import TextLabel from '../atoms/TextLabel';

import styles from './ArtifactRow.module.css';

export type ArtifactMark = 'authored' | 'draft' | 'fresh' | 'stale' | 'none';

export interface ArtifactRowProps {
  /** Имя артефакта: «каст-план», «спайн», «мировой календарь», … */
  artifactName: string;
  /** Отметка свежести: готово вручную / готово / устарело / не создано. */
  mark?: ArtifactMark;
}

/** Слова-состояния фиксированы вместе с глифом — как и сам глиф у StatusGlyph. */
const MARK_WORD: Record<ArtifactMark, string> = {
  authored: 'authored',
  // Посчитано незакоммиченным прогоном: работа есть, в историю ещё не легла.
  draft: 'черновик',
  fresh: 'fresh',
  stale: 'stale',
  none: 'нет',
};

/** `authored` не входит в алфавит StatusGlyph (нет глифа ✎) — рисуем локально. */
const GLYPH_STATUS: Record<'fresh' | 'stale' | 'none', StatusGlyphStatus> = {
  fresh: 'fresh',
  stale: 'stale',
  none: 'none',
};

/**
 * Порт `design_ref/components/ArtifactRow.dc.html` (molecules.json#k023).
 * Строка артефакта в списке зоны: имя и отметка свежести. У исходника нет
 * пропа `context` — строка всегда живёт на тёмном хроме дока/зоны (тот же
 * вывод, что и в `ToolbarStatus`), поэтому `onDark` здесь не нужен.
 */
const ArtifactRow = ({ artifactName, mark = 'fresh' }: ArtifactRowProps) => {
  return (
    <div className={styles.root}>
      <TextLabel text={artifactName} onDark size={10.5} />
      <span className={styles.dot} aria-hidden="true">
        ·
      </span>
      <span className={styles.mark}>
        {mark === 'authored' ? (
          <span className={styles.pencil} aria-hidden="true">
            ✎
          </span>
        ) : mark === 'draft' ? (
          <span className={styles.pencil} aria-hidden="true">
            ◔
          </span>
        ) : (
          <StatusGlyph status={GLYPH_STATUS[mark]} onDark size={10.5} />
        )}
        <TextLabel text={MARK_WORD[mark]} onDark size={10.5} />
      </span>
    </div>
  );
};

export default ArtifactRow;
