import React from 'react';

import Divider from '../atoms/Divider';
import Heading from '../atoms/Heading';
import NotifyDot from '../atoms/NotifyDot';
import ToneSurface from '../atoms/ToneSurface';

import styles from './PanelSpine.module.css';

export type PanelSpineSide = 'left' | 'right';

export interface PanelSpineProps {
  /** Подпись панели, читается сверху вниз вдоль корешка. */
  title?: string;
  /** С какой стороны дока стоит панель — определяет, куда смотрит стрелка и где хайрлайн. */
  side?: PanelSpineSide;
  /** В свёрнутой панели есть непросмотренное. */
  notify?: boolean;
  /** Высота корешка, px — совпадает с высотой развёрнутой панели. */
  height?: number;
  /** Без колбэка корешок статичен, а не кликабелен. */
  onExpand?: () => void;
}

/**
 * Порт `design_ref/components/PanelSpine.dc.html` (molecules.json#p038).
 * Корешок свёрнутой панели в доке: узкая вертикальная полоса с заголовком,
 * стрелкой-указателем разворота и точкой непросмотренного. Хайрлайн стоит на
 * той стороне корешка, что смотрит в сторону вьюпорта.
 */
const PanelSpine = ({ title = 'Иерархия', side = 'left', notify = false, height = 170, onExpand }: PanelSpineProps) => {
  const isLeft = side === 'left';
  const arrowGlyph = isLeft ? '▸' : '◂';
  const tip = `Развернуть панель «${title}»`;

  const body = (
    <>
      <span className={styles.arrow} aria-hidden="true">
        {arrowGlyph}
      </span>
      <span className={styles.titleWrap}>
        <Heading text={title} level="card" size={10} onDark />
      </span>
      {notify && <NotifyDot tone="yellow" size={6} />}
    </>
  );

  const trigger = onExpand ? (
    <button type="button" className={styles.trigger} style={{ height: `${height}px` }} title={tip} onClick={onExpand}>
      {body}
    </button>
  ) : (
    <div className={styles.trigger} style={{ height: `${height}px` }} title={tip}>
      {body}
    </div>
  );

  const hairline = <Divider orientation="vertical" onDark quiet length={height} />;

  return (
    <ToneSurface tone="darkAccent" padding={0}>
      <div className={styles.pad}>
        {!isLeft && hairline}
        {trigger}
        {isLeft && hairline}
      </div>
    </ToneSurface>
  );
};

export default PanelSpine;
