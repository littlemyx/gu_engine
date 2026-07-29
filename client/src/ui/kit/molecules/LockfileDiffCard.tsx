import React from 'react';

import CornerMarks from '../atoms/CornerMarks';
import Frame from '../atoms/Frame';
import Heading from '../atoms/Heading';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './LockfileDiffCard.module.css';

export interface LockfileDiffCardProps {
  /** Заголовок диффа, напр. «Что изменилось с v2 · diff lockfile-ов». */
  title: string;
  /** Мета-строка справа от заголовка, напр. «12 отпечатков разошлись». */
  meta: string;
  /** Сводка изменений одной строкой. */
  summary: string;
  /** Хвост сводки после « · », напр. «медиа: без изменений». Пусто — не рисуется. */
  note?: string;
}

/**
 * Порт `design_ref/components/LockfileDiffCard.dc.html` (molecules.json#k098,
 * «КАРТОЧКА DIFF LOCKFILE-ОВ (БЛЮПРИНТ)»).
 * Итог сравнения двух lockfile-ов истории: что изменилось (проза/юниты/
 * концовки) и что осталось прежним. Карточка всегда на бумажном фоне —
 * как распечатка, — независимо от того, тёмный вокруг хром или светлый.
 */
const LockfileDiffCard = ({ title, meta, summary, note = '' }: LockfileDiffCardProps) => {
  const hasNote = note !== '';

  return (
    <CornerMarks tone="plain">
      <Frame tone="light" fill="paper" interactive={false} paddingX={14} paddingY={12} block>
        <div className={styles.headRow}>
          <Heading text={title} level="card" uppercase={false} />
          <MutedText text={meta} size={9.5} />
        </div>
        <div className={styles.summaryRow}>
          <TextLabel text={summary} size={10.5} />
          {hasNote && (
            <>
              <span className={styles.sep}> · </span>
              <MutedText text={note} size={10.5} />
            </>
          )}
        </div>
      </Frame>
    </CornerMarks>
  );
};

export default LockfileDiffCard;
