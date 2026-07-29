import React from 'react';

import AccentText from '../atoms/AccentText';
import MutedText from '../atoms/MutedText';
import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';
import TextLabel from '../atoms/TextLabel';

import styles from './QARow.module.css';

export type QARowKind = 'ошибка' | 'предупреждение' | 'ок';

export interface QARowProps {
  /** Тяжесть находки. По умолчанию `ошибка` — как в макете. */
  kind?: QARowKind;
  title: string;
  meta: string;
  /** Подпись действия. Без неё хвост строки не рисуется вовсе. */
  action?: string;
  /** Есть колбэк — действие кликабельно; нет колбэка — статичная подпись. */
  onAction?: () => void;
  onDark?: boolean;
}

/** Алфавит QA-находки — три из семи статусов `StatusGlyph`. */
const GLYPH_STATUS: Record<QARowKind, StatusGlyphStatus> = {
  ошибка: 'fail',
  предупреждение: 'warn',
  ок: 'ok',
};

/**
 * Порт `design_ref/components/QARow.dc.html` (molecules.json#p033).
 * Строка отчёта проверки: глиф тяжести, заголовок находки, поясняющая мета
 * (обрезается многоточием) и необязательное действие справа — «показать в
 * чертеже» и подобные переходы к месту проблемы.
 */
const QARow = ({ kind = 'ошибка', title, meta, action, onAction, onDark = false }: QARowProps) => {
  return (
    <div className={styles.root}>
      <span className={styles.glyph}>
        <StatusGlyph status={GLYPH_STATUS[kind]} onDark={onDark} size={11.5} spin={false} />
      </span>
      <span className={styles.title}>
        <TextLabel text={title} onDark={onDark} bold size={11.5} />
      </span>
      <span className={styles.meta}>
        <MutedText text={meta} onDark={onDark} size={11.5} />
      </span>
      {action &&
        (onAction ? (
          <button type="button" className={[styles.action, styles.actionButton].join(' ')} onClick={onAction}>
            <AccentText text={action} tone="accent" onDark={onDark} size={10.5} />
          </button>
        ) : (
          <span className={styles.action}>
            <AccentText text={action} tone="accent" onDark={onDark} size={10.5} />
          </span>
        ))}
    </div>
  );
};

export default QARow;
