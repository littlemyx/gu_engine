import React from 'react';

import styles from './PriceTag.module.css';

export type PriceTagVariant = 'button' | 'standalone' | 'total';

/**
 * Тон кодирует состояние стадии, к которой относится сумма. `neutral` — цвет
 * по умолчанию, определяется только вариантом (как раньше); остальные тона
 * перекрывают именно цвет, не трогая кегль/жирность/прозрачность варианта.
 */
export type PriceTagTone = 'neutral' | 'accent' | 'muted' | 'error';

/** `mono` — прежнее поведение (`--gu-mono`); `body` — смета внутри карточки, набранная основным шрифтом. */
export type PriceTagFontFamily = 'mono' | 'body';

export interface PriceTagProps {
  value: string;
  variant?: PriceTagVariant;
  /** Реперная точка живёт на тёмном хроме. */
  onDark?: boolean;
  /** Переопределяет размер шрифта варианта, px. */
  sizePx?: number;
  /** Состояние стадии: акцент, приглушённый или ошибка. По умолчанию цвет варианта не трогается. */
  tone?: PriceTagTone;
  /** Гарнитура значения. По умолчанию — моноширинная, как в исходном макете. */
  fontFamily?: PriceTagFontFamily;
}

const VARIANT_CLASS: Record<PriceTagVariant, string> = {
  button: styles.button,
  standalone: styles.standalone,
  total: styles.total,
};

const TONE_CLASS: Record<PriceTagTone, string> = {
  neutral: '',
  accent: styles.toneAccent,
  muted: styles.toneMuted,
  error: styles.toneError,
};

const FONT_FAMILY_CLASS: Record<PriceTagFontFamily, string> = {
  mono: '',
  body: styles.fontBody,
};

/**
 * Порт `design_ref/components/PriceTag.dc.html` (atoms.json#PriceTag).
 * Стоимость ≈$0.02 рядом с действием: приглушённая цифра внутри кнопки
 * (`button`), чуть заметнее сама по себе (`standalone`) и жирным итогом там,
 * где сумма — главный ответ (`total`). `tone` красит сумму по состоянию
 * стадии (акцент/приглушённый/ошибка) поверх варианта, `fontFamily`
 * переключает гарнитуру на `var(--font-body)` для сметы внутри карточки.
 */
const PriceTag = ({
  value,
  variant = 'standalone',
  onDark = false,
  sizePx,
  tone = 'neutral',
  fontFamily = 'mono',
}: PriceTagProps) => {
  const className = [
    styles.root,
    VARIANT_CLASS[variant],
    onDark ? styles.onDark : '',
    TONE_CLASS[tone],
    FONT_FAMILY_CLASS[fontFamily],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} style={sizePx ? { fontSize: `${sizePx}px` } : undefined}>
      {value}
    </span>
  );
};

export default PriceTag;
