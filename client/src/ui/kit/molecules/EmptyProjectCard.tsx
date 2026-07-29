import React from 'react';

import CornerMarks from '../atoms/CornerMarks';
import Frame from '../atoms/Frame';
import Heading from '../atoms/Heading';
import MutedText from '../atoms/MutedText';
import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';

import styles from './EmptyProjectCard.module.css';

export interface EmptyProjectCardProps {
  title?: string;
  sub?: string;
  /** Заголовок первой дорожки, напр. «1 · С нуля». */
  t1Title?: string;
  t1Desc?: string;
  t1Action?: string;
  /** Смета печатается прямо в кнопке дорожки 1. */
  t1Price?: string;
  onStart1?: () => void;
  /** Заголовок второй дорожки, напр. «2 · Из префабов». */
  t2Title?: string;
  t2Desc?: string;
  t2Action?: string;
  onStart2?: () => void;
}

/**
 * Порт `design_ref/components/EmptyProjectCard.dc.html` (molecules.json#p045,
 * «КАРТОЧКА ПУСТОГО ПРОЕКТА (blueprint, 2 дорожки)»).
 * Стартовый экран пустого проекта: две равноценные дорожки начать историю —
 * с нуля через бриф или из библиотеки префабов. Карточка всегда на бумажном
 * фоне, как распечатка, независимо от хрома вокруг.
 */
const EmptyProjectCard = ({
  title = 'Пустая история',
  sub = 'Два способа начать — их можно совмещать.',
  t1Title = '1 · С нуля',
  t1Desc = 'Заполните бриф (жанр, тон, длительность) — конвейер соберёт каст, мир и хребет.',
  t1Action = 'Заполнить бриф',
  t1Price = '≈ $0.50',
  onStart1,
  t2Title = '2 · Из префабов',
  t2Desc = 'Перетащите персонажей, мир или аудио-сет из дока внизу — генерация допишет остальное дешевле.',
  t2Action = 'Открыть библиотеку',
  onStart2,
}: EmptyProjectCardProps) => (
  <CornerMarks tone="plain">
    <Frame tone="light" fill="paper" interactive={false} paddingX={28} paddingY={24} block>
      <Heading text={title} level="screen" />
      <div className={styles.sub}>
        <MutedText text={sub} size={12.5} />
      </div>
      <div className={styles.tracks}>
        <div className={styles.track}>
          <Heading text={t1Title} level="card" size={13} />
          <div className={styles.trackDesc}>
            <MutedText text={t1Desc} size={11.5} />
          </div>
          <div className={styles.trackAction}>
            <PrimaryButton label={t1Action} price={t1Price} size="compact" block marks={false} onClick={onStart1} />
          </div>
        </div>
        <div className={styles.track}>
          <Heading text={t2Title} level="card" size={13} />
          <div className={styles.trackDesc}>
            <MutedText text={t2Desc} size={11.5} />
          </div>
          <div className={styles.trackAction}>
            <OutlineButton label={t2Action} tone="accent" size="compact" onDark={false} onClick={onStart2} />
          </div>
        </div>
      </div>
    </Frame>
  </CornerMarks>
);

export default EmptyProjectCard;
