import React from 'react';

import Badge from '../atoms/Badge';
import CornerMarks from '../atoms/CornerMarks';
import Frame from '../atoms/Frame';
import Heading from '../atoms/Heading';
import MonoText from '../atoms/MonoText';

import styles from './ReleaseCard.module.css';

export type ReleaseCardTone = 'accent' | 'обычная';

export interface ReleaseCardProps {
  /** Заголовок релиза: «Релиз v2 · 14 июля · иммутабельный». */
  title: string;
  /** Бейдж статуса, например «QA #5 ✓». Пусто — бейдж не рисуется. */
  badge?: string;
  /** Строки статистики моношрифтом: «слотов 21», «юнитов 44» и т. п. */
  stats?: string[];
  tone?: ReleaseCardTone;
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/ReleaseCard.dc.html` (molecules.json#k099,
 * «КАРТОЧКА РЕЛИЗА (БЛЮПРИНТ) · СО СТАТИСТИКОЙ»).
 * Карточка иммутабельного релиза: заголовок с опциональным бейджем статуса,
 * строка статистики моношрифтом и место под произвольное содержимое снизу
 * (например, действия). Акцентная рамка отмечает текущий/выбранный релиз.
 */
const ReleaseCard = ({ title, badge = '', stats = [], tone = 'accent', onClick, children }: ReleaseCardProps) => {
  const accent = tone === 'accent';
  const hasBadge = badge !== '';
  const hasChildren = !!children;

  return (
    <CornerMarks tone={accent ? 'accent' : 'plain'}>
      <Frame
        tone={accent ? 'accent' : 'light'}
        fill="paper"
        paddingY={12}
        paddingX={14}
        interactive={!!onClick}
        onClick={onClick}
        block
      >
        <div className={styles.header}>
          <Heading text={title} level="card" uppercase={false} size={13} />
          {hasBadge && <Badge label={badge} tone="accent" />}
        </div>
        {stats.length > 0 && (
          <div className={styles.statsRow}>
            {stats.map((stat, index) => (
              <MonoText key={index} text={stat} size={10.5} />
            ))}
          </div>
        )}
        {hasChildren && <div className={styles.childrenRow}>{children}</div>}
      </Frame>
    </CornerMarks>
  );
};

export default ReleaseCard;
