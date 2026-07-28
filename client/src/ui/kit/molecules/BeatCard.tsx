import React from 'react';

import Heading from '../atoms/Heading';
import Kicker from '../atoms/Kicker';
import SelectionHighlight from '../atoms/SelectionHighlight';

import styles from './BeatCard.module.css';

export type BeatCardState = 'done' | 'failed' | 'running' | 'locked';

export interface BeatCardProps {
  /** Строка над заголовком: номер бита и диапазон дней («Бит 04 · Д4д–Д4в»). */
  kicker: string;
  title: string;
  /** Переопределяет дефолтный текст статуса для данного `state`. */
  statusText?: string;
  state?: BeatCardState;
  selected?: boolean;
  /** Притушенная карточка — например, отфильтрована выбором ветки. */
  dimmed?: boolean;
  /** px, 120–260 в макете. */
  width?: number;
  onSelect?: () => void;
}

const STATE_STATUS: Record<BeatCardState, string> = {
  done: 'проза ✓',
  failed: '▨ нет прозы',
  running: '⟳ генерируется…',
  locked: 'заперт календарным полом',
};

const STATE_CLASS: Record<BeatCardState, string> = {
  done: styles.stateDone,
  failed: styles.stateFailed,
  running: styles.stateRunning,
  locked: styles.stateLocked,
};

const STATUS_CLASS: Record<BeatCardState, string> = {
  done: styles.statusDone,
  failed: styles.statusFailed,
  running: styles.statusRunning,
  locked: styles.statusLocked,
};

/**
 * Порт `design_ref/components/BeatCard.dc.html` (molecules.json#k013).
 * Карточка бита в партитуре: кикер + заголовок + статус прозы. Состояние
 * (`done` / `failed` / `running` / `locked`) кодирует стиль рамки и заливки —
 * так же, как календарный статус сцены в «Партитуре».
 */
const BeatCard = ({
  kicker,
  title,
  statusText,
  state = 'done',
  selected = false,
  dimmed = false,
  width = 150,
  onSelect,
}: BeatCardProps) => {
  const status = statusText || STATE_STATUS[state];

  const className = [styles.root, STATE_CLASS[state], onSelect ? styles.interactive : '', dimmed ? styles.dimmed : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className={styles.kickerRow}>
        <Kicker text={kicker} tone="neutral" size={8.5} />
      </div>
      <div className={state === 'locked' ? `${styles.titleRow} ${styles.titleLocked}` : styles.titleRow}>
        <Heading text={title} level="card" uppercase={false} size={12} />
      </div>
      <span className={`${styles.status} ${STATUS_CLASS[state]}`}>{status}</span>
    </>
  );

  const card = onSelect ? (
    <button type="button" className={className} style={{ width }} onClick={onSelect}>
      {content}
    </button>
  ) : (
    <div className={className} style={{ width }}>
      {content}
    </div>
  );

  if (!selected) return card;

  return (
    <SelectionHighlight variant="outline" padding={0}>
      {card}
    </SelectionHighlight>
  );
};

export default BeatCard;
