import React from 'react';

import MonoText from '../atoms/MonoText';
import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';
import TextLabel, { type TextLabelTone } from '../atoms/TextLabel';

import styles from './ImportRow.module.css';

export type ImportRowState = 'ок' | 'предупреждение' | 'пропуск';

export interface ImportRowProps {
  /** Путь импортируемого поля: `world.setting`, `beat.trigger`, … */
  path: string;
  /** Импортируемое значение: строка, перечисление через « · », … */
  value: string;
  state?: ImportRowState;
  /** Ширина колонки пути, px. */
  pathWidth?: number;
  /** Ширина всей строки, px. */
  width?: number;
}

const GLYPH_STATUS: Record<ImportRowState, StatusGlyphStatus> = {
  ок: 'ok',
  предупреждение: 'warn',
  пропуск: 'none',
};

const VALUE_TONE: Record<ImportRowState, TextLabelTone> = {
  ок: 'normal',
  предупреждение: 'warn',
  пропуск: 'muted',
};

/**
 * Порт `design_ref/components/ImportRow.dc.html` (molecules.json#p020).
 * Строка предпросмотра импорта: глиф статуса поля, его путь моноширинным
 * шрифтом и разобранное значение. Три состояния поля — ок / предупреждение /
 * пропуск — красят и глиф, и значение одной парой цветов. У исходника нет
 * пропа `context` — строка всегда живёт на светлой рабочей области (там же,
 * где сам диалог импорта), поэтому `onDark` здесь не нужен.
 */
const ImportRow = ({ path, value, state = 'ок', pathWidth = 118, width = 480 }: ImportRowProps) => {
  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <span className={styles.glyph}>
        <StatusGlyph status={GLYPH_STATUS[state]} spin={false} size={11.5} />
      </span>
      <span className={styles.path} style={{ width: `${pathWidth}px` }}>
        <MonoText text={path} size={10.5} />
      </span>
      <span className={styles.value}>
        <TextLabel text={value} tone={VALUE_TONE[state]} />
      </span>
    </div>
  );
};

export default ImportRow;
