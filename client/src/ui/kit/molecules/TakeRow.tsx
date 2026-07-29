import React from 'react';

import Frame from '../atoms/Frame';

import styles from './TakeRow.module.css';

export type TakeRowStatus = 'принят' | 'черновик' | 'отклонён' | 'генерируется';

type StatusTone = 'accent' | 'neutral' | 'error';

interface StatusMeta {
  prefix?: string;
  suffix?: string;
  tone: StatusTone;
}

export interface TakeRowProps {
  /** Номер тейка, 1–99. */
  num: number;
  /** Что менялось в тейке, например «✎ ручная правка». */
  label: string;
  status?: TakeRowStatus;
  /** Переопределяет текст статуса произвольной строкой (напр. «дубль от Иры») — красится приглушённым тоном, как «черновик». */
  action?: string;
  selected?: boolean;
  onClick?: () => void;
}

const STATUS_META: Record<TakeRowStatus, StatusMeta> = {
  принят: { suffix: ' ✓', tone: 'accent' },
  черновик: { tone: 'neutral' },
  отклонён: { suffix: ' ✕', tone: 'error' },
  генерируется: { prefix: '⟳ ', suffix: '…', tone: 'accent' },
};

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  accent: styles.statusAccent,
  neutral: styles.statusNeutral,
  error: styles.statusError,
};

/**
 * Порт `design_ref/components/TakeRow.dc.html` (molecules.json#k016,
 * «СТРОКА ТЕЙКА»).
 * Строка тейка в ленте дублей: номер, что менялось, и статус (принят /
 * черновик / отклонён / генерируется) — либо произвольный текст действия
 * вместо статуса. У исходника нет пропа `context` — строка всегда живёт на
 * тёмном хроме дока рядом с партитурой (тот же вывод, что и в `BeatRow`),
 * поэтому `onDark` здесь не нужен. Номер, подпись и статус собраны локально,
 * а не атомами `Counter`/`TextLabel`/`Badge`: макету нужны точные оттенки —
 * жирный `--gu-signal-run` у номера, полный `--gu-ink` (не `--gu-ink-85`) у
 * подписи и `--gu-ink-50` (не `--gu-ink-75`) у приглушённого статуса, — а ни
 * один из атомов такой набор не даёт (см. `missingAtoms` отчёта). `Frame`
 * держит рамку и инсет выбора; фон-подсветку строки Frame не умеет, поэтому
 * она — локальный модификатор поверх тех же токенов `--color-accent`/
 * `--gu-ink`, тем же приёмом, что в `BranchTag`. Кликабельное — обычная
 * `<button>`: в отличие от `BeatRow`/`HierarchyRow`, строка не несёт вложенных
 * кнопок, так что конфликта тегов нет.
 */
const TakeRow = ({ num, label, status = 'принят', action = '', selected = false, onClick }: TakeRowProps) => {
  const meta = STATUS_META[status];
  const statusText = action ? action : `${meta.prefix ?? ''}${status}${meta.suffix ?? ''}`;
  const statusTone: StatusTone = action ? 'neutral' : meta.tone;

  const bodyClassName = [styles.body, selected ? styles.bodySelected : styles.bodyPlain].join(' ');

  const inner = (
    <span className={styles.frameSlot}>
      <Frame tone={selected ? 'accent' : 'dark'} selected={selected} interactive={false} padding={0}>
        <span className={bodyClassName}>
          <span className={styles.num}>№{num}</span>
          <span className={styles.label}>{label}</span>
          <span className={[styles.status, STATUS_TONE_CLASS[statusTone]].join(' ')}>{statusText}</span>
        </span>
      </Frame>
    </span>
  );

  if (!onClick) {
    return <div className={styles.root}>{inner}</div>;
  }

  return (
    <button type="button" className={[styles.root, styles.clickable].join(' ')} onClick={onClick}>
      {inner}
    </button>
  );
};

export default TakeRow;
