import React from 'react';

import Frame from '../atoms/Frame';
import Glyph from '../atoms/Glyph';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './FileRow.module.css';

export interface FileRowProps {
  /** Имя файла, моноширинно: «sample-brief.json». Проп `name` в макете
   * переименован — там это зарезервированный атрибут инструмента дизайна. */
  fileName: string;
  /** Мета-строка: размер, версия, статус валидации —
   * «3.5 КБ · version 0.1 ✓ схема валидна». */
  meta: string;
  /** Подпись действия справа, напр. «заменить…». */
  actionLabel?: string;
  /** Ширина строки, px (300–640 в макете). */
  width?: number;
  /** Без колбэка действие нерактивно и рендерится как обычный текст. */
  onAction?: () => void;
}

/**
 * Порт `design_ref/components/FileRow.dc.html` (molecules.json#p019, «СТРОКА ФАЙЛА»).
 * Строка загруженного файла: квадратная иконка, моноширинное имя, приглушённая
 * мета (размер/версия/валидность) и действие справа. У исходника нет пропа
 * `context` — фон всегда бумажный (`fill="paper"`), поэтому `onDark` здесь не
 * нужен, как и в `BeforeAfterPair`. Квадратный бокс иконки собран локально
 * (border + фиксированный размер + центрирование) — тот же приём, что уже
 * принят в `PrefabCard.glyphBox`: `Frame` не даёт фиксированный размер и
 * центрирование содержимого, а заводить это в общий атом ради одного случая
 * не задача исполнителя молекулы.
 */
const FileRow = ({ fileName, meta, actionLabel = 'заменить…', width = 480, onAction }: FileRowProps) => {
  const action = <TextLabel text={actionLabel} tone="muted" size={11.5} />;

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <Frame tone="light" fill="paper" interactive={false} block paddingX={10} paddingY={8}>
        <div className={styles.row}>
          <span className={styles.iconBox}>
            <Glyph glyph="⎘" size={12} />
          </span>
          <span className={styles.name}>
            <MonoText text={fileName} size={11.5} />
          </span>
          <span className={styles.meta}>
            <MutedText text={meta} quiet size={11.5} />
          </span>
          {onAction ? (
            <button type="button" className={styles.action} onClick={onAction}>
              {action}
            </button>
          ) : (
            <span className={styles.action}>{action}</span>
          )}
        </div>
      </Frame>
    </div>
  );
};

export default FileRow;
