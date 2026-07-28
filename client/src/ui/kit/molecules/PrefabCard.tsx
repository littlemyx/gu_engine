import React from 'react';

import Badge from '../atoms/Badge';
import Frame from '../atoms/Frame';
import Glyph from '../atoms/Glyph';
import Heading from '../atoms/Heading';
import Kicker from '../atoms/Kicker';
import MutedText from '../atoms/MutedText';

import styles from './PrefabCard.module.css';

export type PrefabCardTone = 'ok' | 'wait' | 'bad' | 'muted';

export interface PrefabCardProps {
  /** Символ-иконка префаба: ◐ ♪ ⧉ и т.п. */
  glyph: string;
  /** Название и версия: «Кира v3». */
  title: string;
  /** Тип префаба: «персонаж», «мир», «аудио-набор». */
  kind: string;
  /** Мета источника: «обновлена 25 июля». */
  src: string;
  /** Состояние связи с кастом: «закастована v2 → есть v3». */
  status: string;
  tone?: PrefabCardTone;
  selected?: boolean;
  /** Карточка сейчас тащится по DnD: пунктирная рамка и тонированный фон. */
  dragging?: boolean;
  onClick?: () => void;
}

const STATUS_BADGE_TONE: Record<PrefabCardTone, 'neutral' | 'accent' | 'error'> = {
  ok: 'accent',
  wait: 'neutral',
  bad: 'error',
  muted: 'neutral',
};

/**
 * Порт `design_ref/components/PrefabCard.dc.html` (molecules.json#k031 PrefabCard).
 * Карточка префаба в библиотеке: иконка, заголовок с версией, тип, источник и
 * бейдж состояния связи с кастом истории. В макете нет светлого варианта —
 * карточка живёт только на тёмном хроме библиотеки префабов.
 */
const PrefabCard = ({
  glyph,
  title,
  kind,
  src,
  status,
  tone = 'wait',
  selected = false,
  dragging = false,
  onClick,
}: PrefabCardProps) => {
  const badgeTone = STATUS_BADGE_TONE[tone];

  const body = (
    <>
      <div className={styles.topRow}>
        <span className={styles.glyphBox}>
          <Glyph glyph={glyph} onDark size={13} />
        </span>
        <div className={styles.titleBlock}>
          <Heading text={title} level="card" uppercase={false} onDark size={11.5} />
          <Kicker text={kind} onDark size={9.5} />
        </div>
      </div>
      <div className={styles.srcRow}>
        <MutedText text={src} onDark size={9.5} />
      </div>
      <div className={[styles.statusRow, tone === 'muted' ? styles.statusMuted : ''].filter(Boolean).join(' ')}>
        <Badge label={status} tone={badgeTone} onDark size={9.5} />
      </div>
    </>
  );

  const surface = onClick ? (
    <button type="button" className={[styles.surface, styles.button].join(' ')} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.surface}>{body}</div>
  );

  return (
    <div className={[styles.root, dragging ? styles.dragging : ''].filter(Boolean).join(' ')}>
      <Frame tone="dark" selected={selected} interactive={false} padding={0}>
        {surface}
      </Frame>
    </div>
  );
};

export default PrefabCard;
