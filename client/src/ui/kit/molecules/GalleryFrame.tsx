import React from 'react';

import CornerMarks from '../atoms/CornerMarks';
import Heading from '../atoms/Heading';
import Kicker from '../atoms/Kicker';
import MutedText from '../atoms/MutedText';
import Shadow, { type ShadowSize } from '../atoms/Shadow';

import styles from './GalleryFrame.module.css';

export type GalleryFrameElevation = 'none' | 'sm' | 'md' | 'lg';

export interface GalleryFrameProps {
  /** Надзаголовок, напр. «ГАЛЕРЕЯ · dialogue_units / …». */
  kicker: string;
  /** Заголовок, напр. «Проза · diff тейков». */
  title: string;
  /** Необязательная приписка справа от заголовка, напр. «14 из 20». */
  meta?: string;
  /** Тень блока; `none` — без тени. */
  elevation?: GalleryFrameElevation;
  /** Ширина рамки в px; в макете диапазон 180–640, по умолчанию 240. */
  width?: number;
  /** Внутренний отступ в px, по умолчанию 14. */
  padding?: number;
  /** Кегль заголовка в px, по умолчанию 15. */
  titleSize?: number;
  children?: React.ReactNode;
}

const SHADOW_SIZE: Record<Exclude<GalleryFrameElevation, 'none'>, ShadowSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

/**
 * Порт `design_ref/components/GalleryFrame.dc.html` (molecules.json#k101,
 * «БЛЮПРИНТ-РАМКА ГАЛЕРЕИ»). Чертёжная витрина примера: реперы по углам, кикер
 * и заголовок (с необязательной припиской справа) в шапке, тень и произвольное
 * содержимое ниже. `Frame` в бордюр не годится — атом не несёт тона
 * `blueprint-900` (только до `blueprint-700`), а рамке галереи нужен именно
 * он, поэтому бордюр и заливка фона сделаны локально на том же токене.
 */
const GalleryFrame = ({
  kicker,
  title,
  meta,
  elevation = 'lg',
  width = 240,
  padding = 14,
  titleSize = 15,
  children,
}: GalleryFrameProps) => {
  const body = (
    <CornerMarks tone="plain">
      <div className={styles.root} style={{ width: `${width}px`, padding: `${padding}px` }}>
        <div className={styles.kickerRow}>
          <Kicker text={kicker} size={8.5} />
        </div>
        <div className={styles.titleRow}>
          <Heading text={title} uppercase={false} size={titleSize} />
          {meta && (
            <span className={styles.meta}>
              <MutedText text={meta} size={10} />
            </span>
          )}
        </div>
        {children && <div className={styles.body}>{children}</div>}
      </div>
    </CornerMarks>
  );

  if (elevation === 'none') {
    return body;
  }

  return <Shadow size={SHADOW_SIZE[elevation]}>{body}</Shadow>;
};

export default GalleryFrame;
