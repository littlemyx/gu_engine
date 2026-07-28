import React from 'react';

import Kicker from '../atoms/Kicker';

import styles from './StageCard.module.css';

/**
 * Порт `design_ref/components/StageCard.dc.html` (molecules.json#k019,
 * «КАРТОЧКА СТАДИИ ПАЙПЛАЙНА»).
 * Плашка стадии пайплайна: код стадии, счёт слотов и (опционально) смета
 * довода до готовности. Тон кодирует состояние стадии — активна сейчас,
 * обычная, требует внимания или выполняется — рамкой, заливкой и цветом
 * подписей; кликабельная только когда передан `onClick`.
 */

export type StageCardTone = 'active' | 'default' | 'attention' | 'running';
export type StageCardPriceTone = 'auto' | 'accent' | 'muted' | 'error';

export interface StageCardProps {
  /** Код стадии с порядком, например «2 · ПРОЗА». */
  kicker: string;
  /** Счёт слотов, например «31 готово · 9 устарело · 4 нет». */
  stats: string;
  /** Смета довода до готовности, например «довести ≈$1.36». Пусто — строка не рисуется. */
  price?: string;
  /** Тон сметы; «авто» берёт цвет из `tone` стадии. */
  priceTone?: StageCardPriceTone;
  tone?: StageCardTone;
  /** px или «fill» (растянуть на всю ширину контейнера). */
  width?: number | 'fill';
  onClick?: () => void;
}

const TONE_CLASS: Record<StageCardTone, string> = {
  active: styles.active,
  default: styles.default,
  attention: styles.attention,
  running: styles.running,
};

/** Кегль надзаголовка в Kicker-атоме не имеет отдельного тона под «выполняется»
 * (макет там задаёт другой оттенок синего, `#cfe2f2`, которого нет в ките) —
 * используем ближайший имеющийся тон `accent`, как и для «активна». */
const KICKER_TONE: Record<StageCardTone, 'accent' | 'neutral' | 'error'> = {
  active: 'accent',
  default: 'neutral',
  attention: 'error',
  running: 'accent',
};

const PRICE_TONE_BY_STAGE_TONE: Record<StageCardTone, Exclude<StageCardPriceTone, 'auto'>> = {
  active: 'accent',
  default: 'muted',
  attention: 'error',
  running: 'accent',
};

const PRICE_TONE_CLASS: Record<Exclude<StageCardPriceTone, 'auto'>, string> = {
  accent: styles.priceAccent,
  muted: styles.priceMuted,
  error: styles.priceError,
};

const StageCard = ({
  kicker,
  stats,
  price,
  priceTone = 'auto',
  tone = 'active',
  width = 220,
  onClick,
}: StageCardProps) => {
  const effectivePriceTone = priceTone === 'auto' ? PRICE_TONE_BY_STAGE_TONE[tone] : priceTone;

  const rootClassName = [styles.root, TONE_CLASS[tone], onClick ? styles.clickable : ''].filter(Boolean).join(' ');
  const priceClassName = [styles.price, PRICE_TONE_CLASS[effectivePriceTone]].filter(Boolean).join(' ');
  const style: React.CSSProperties = { width: width === 'fill' ? '100%' : `${width}px` };

  const content = (
    <>
      <Kicker text={kicker} tone={KICKER_TONE[tone]} onDark size={9} />
      <div className={styles.stats}>{stats}</div>
      {price ? <div className={priceClassName}>{price}</div> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className={rootClassName} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" className={rootClassName} style={style} onClick={onClick}>
      {content}
    </button>
  );
};

export default StageCard;
