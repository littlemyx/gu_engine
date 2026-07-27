import React from 'react';

import styles from './PrefabCard.module.css';

export type PrefabTone = 'ok' | 'wait' | 'bad' | 'muted';

export interface PrefabCardProps {
  glyph?: string;
  title: string;
  kind?: string;
  /** Откуда пришёл: «из «Лета на Взморье»». */
  src?: string;
  /** «в 2 историях», «⟳ в очереди». */
  status?: string;
  tone?: PrefabTone;
  selected?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLElement>) => void;
}

const TONE_CLASS: Record<PrefabTone, string> = {
  ok: styles.ok,
  wait: styles.wait,
  bad: styles.bad,
  muted: styles.muted,
};

/** Карточка дока: одним компонентом рисуются и префабы, и ассеты. */
const PrefabCard = ({
  glyph = '◐',
  title,
  kind = 'персонаж',
  src = '',
  status = '',
  tone = 'ok',
  selected = false,
  dragging = false,
  draggable = false,
  onClick,
  onDragStart,
  onDragEnd,
}: PrefabCardProps) => {
  const className = [styles.root, selected ? styles.selected : '', dragging ? styles.dragging : '']
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <div className={styles.head}>
        <span className={styles.glyph}>{glyph}</span>
        <div className={styles.titleCol}>
          <div className={styles.title} title={title}>
            {title}
          </div>
          <div className={styles.kind}>{kind}</div>
        </div>
      </div>
      <div className={styles.src}>{src}</div>
      <div className={`${styles.status} ${TONE_CLASS[tone] ?? TONE_CLASS.ok}`}>{status}</div>
    </>
  );

  if (!onClick) {
    return (
      <div className={className} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {body}
    </button>
  );
};

export default PrefabCard;
