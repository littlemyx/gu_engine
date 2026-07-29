import React from 'react';

import AccentText from '../atoms/AccentText';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './PassportKV.module.css';

export type PassportKVValueFormat = 'plain' | 'mono' | 'accent';

export interface PassportKVRow {
  /** Ключ слева, напр. «модель», «стоимость». */
  key: string;
  /** Значение справа, напр. «gpt-4.1-mini», «$0.014 · 2 попытки». */
  value: string;
  /** Начертание значения: моноширинное (id/версия модели) или акцентное (статус). */
  format?: PassportKVValueFormat;
}

/**
 * Порт `design_ref/components/PassportKV.dc.html` (molecules.json#p034,
 * «ПАСПОРТ ГЕНЕРАЦИИ · PassportKV»).
 * Двухколоночная таблица ключ-значение без рамки: модель, стоимость, проверки,
 * статус генерации. Ключ всегда приглушённый (`MutedText`), значение красится
 * по `format` строки — `plain` обычным `TextLabel`, `mono` моноширинным
 * `MonoText`, `accent` акцентным `AccentText` (`tone="accent"`) — это ровно три
 * ветки `renderVals` исходника (`ff`/`fg` по флагу `mono`/`accent`/пусто).
 * Фон-подложка (`backdrop`/`wrapBg`) — обвязка превью дизайн-тула и в порт не
 * идёт: молекула кладётся туда, где ей нужен фон, самим местом использования.
 */
export interface PassportKVProps {
  /** Строки паспорта сверху вниз. */
  rows: PassportKVRow[];
  /** Ширина колонки ключа, px. */
  labelWidth?: number;
  /** Ширина всей таблицы, px. */
  width?: number;
  onDark?: boolean;
}

const PassportKV = ({ rows, labelWidth = 64, width = 280, onDark = false }: PassportKVProps) => {
  return (
    <div className={styles.root} style={{ gridTemplateColumns: `${labelWidth}px 1fr`, width: `${width}px` }}>
      {rows.map((row, index) => (
        <React.Fragment key={`${index}-${row.key}`}>
          <MutedText text={row.key} onDark={onDark} size={11} />
          {row.format === 'mono' && <MonoText text={row.value} onDark={onDark} size={11} />}
          {row.format === 'accent' && <AccentText text={row.value} tone="accent" onDark={onDark} size={11} />}
          {(!row.format || row.format === 'plain') && <TextLabel text={row.value} onDark={onDark} size={11} />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default PassportKV;
