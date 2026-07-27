import React from 'react';

import styles from './BeatCard.module.css';

export type BeatCardState = 'done' | 'failed' | 'running' | 'locked';

export interface BeatCardProps {
  /** Номер бита и его окно: «Бит 04 · Д4д–Д4в». */
  kicker: string;
  title: string;
  state?: BeatCardState;
  /** Переопределяет подпись состояния. Не передавайте '' — статус исчезнет. */
  statusText?: string;
  selected?: boolean;
  dimmed?: boolean;
  /** 120–260px по спеке дизайна. */
  width?: number;
  /** Фиксированная высота: заголовок обрезается по трём строкам. */
  height?: number;
  onClick?: () => void;
}

const STATE_CLASS: Record<BeatCardState, string> = {
  done: styles.done,
  failed: styles.failed,
  running: styles.running,
  locked: styles.locked,
};

const STATE_STATUS: Record<BeatCardState, string> = {
  done: 'проза ✓',
  failed: '▨ нет прозы',
  running: '⟳ генерируется…',
  locked: 'заперт календарным полом',
};

/** Карточка бита хребта на вкладке «Чертёж». */
const BeatCard = ({
  kicker,
  title,
  state = 'done',
  statusText,
  selected = false,
  dimmed = false,
  width = 150,
  height,
  onClick,
}: BeatCardProps) => {
  const stateKey = STATE_CLASS[state] ? state : 'done';
  const className = [
    styles.root,
    STATE_CLASS[stateKey],
    selected ? styles.selected : '',
    dimmed ? styles.dimmed : '',
    height != null ? styles.fixedHeight : '',
  ]
    .filter(Boolean)
    .join(' ');
  const style = { width: `${width}px`, ...(height != null ? { height: `${height}px` } : null) };

  const body = (
    <>
      <div className={styles.kicker}>{kicker}</div>
      <div className={styles.title}>{title}</div>
      <div className={styles.status}>{statusText ?? STATE_STATUS[stateKey]}</div>
    </>
  );

  if (!onClick) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }

  return (
    <button type="button" className={className} style={style} onClick={onClick}>
      {body}
    </button>
  );
};

export default BeatCard;
