import React from 'react';

import Glyph from '../atoms/Glyph';
import MonoText from '../atoms/MonoText';

import styles from './AudioCheckpointRow.module.css';

export type AudioCheckpointRowState = 'ждёт' | 'решён';

export interface AudioCheckpointRowProps {
  /** Идентификатор аудио-чекпоинта, моноширинный, напр. «audio_pier_evening». */
  name: string;
  /** Текст статуса после глифа, напр. «ждёт выбора · A / B →» или «тейк A принят». */
  statusText?: string;
  state?: AudioCheckpointRowState;
  onClick?: () => void;
}

const STATE_GLYPH: Record<AudioCheckpointRowState, string> = {
  ждёт: '⏸',
  решён: '✓',
};

const STATE_CLASS: Record<AudioCheckpointRowState, string> = {
  ждёт: styles.waiting,
  решён: styles.resolved,
};

const STATUS_CLASS: Record<AudioCheckpointRowState, string> = {
  ждёт: styles.statusWaiting,
  решён: styles.statusResolved,
};

const STATUS_GLYPH_TONE: Record<AudioCheckpointRowState, 'accent' | 'muted'> = {
  ждёт: 'accent',
  решён: 'muted',
};

const DEFAULT_STATUS_TEXT: Record<AudioCheckpointRowState, string> = {
  ждёт: 'ждёт выбора · A / B →',
  решён: 'тейк A принят',
};

/**
 * Порт `design_ref/components/AudioCheckpointRow.dc.html` (molecules.json#k074,
 * «СТРОКА АУДИО-ЧЕКПОИНТА»).
 * Строка развилки в аудио-пакете: идентификатор чекпоинта и статус выбора
 * тейка. Пока выбор не сделан, строка держит акцентную 2px-рамку и лёгкую
 * тёплую подсветку фона — заметно среди уже решённых. `AccentText` не подошёл
 * на текст статуса «решён»: в его палитре нет нейтрального/приглушённого
 * тона под серый цвет макета (только info/accent/error/warn), поэтому текст
 * статуса — локальный `<span>` на тех же токенах, что и остальной кит.
 * `Frame` тоже не подошёл: рамка макета в состоянии «ждёт» — 2px, а атом
 * всегда рисует 1px и не даёт тонового фона под состояние; `ToneSurface`
 * даёт только сплошные заливки, а макету нужен полупрозрачный
 * accent-оверлей (`color-mix`) поверх фона строки — см. `missingAtoms`
 * отчёта задачи.
 */
const AudioCheckpointRow = ({ name, statusText, state = 'ждёт', onClick }: AudioCheckpointRowProps) => {
  const resolvedStatusText = statusText ?? DEFAULT_STATUS_TEXT[state];
  const className = [styles.root, STATE_CLASS[state], onClick ? styles.clickable : ''].filter(Boolean).join(' ');

  const content = (
    <>
      <span className={styles.name}>
        <MonoText text={name} size={10.5} />
      </span>
      <span className={[styles.status, STATUS_CLASS[state]].join(' ')}>
        <Glyph glyph={STATE_GLYPH[state]} tone={STATUS_GLYPH_TONE[state]} size={10.5} />
        {resolvedStatusText}
      </span>
    </>
  );

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
};

export default AudioCheckpointRow;
