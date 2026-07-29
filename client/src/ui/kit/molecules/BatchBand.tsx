import React from 'react';

import styles from './BatchBand.module.css';

export type BatchBandTone = 'accent' | 'quiet';

export interface BatchBandProps {
  /** Подпись полосы: «ПОРЦИЯ 2 · СТУПЕНЬ 2 · КИРА — ИДЁТ». Обрезается многоточием. */
  label: string;
  /** Счётчик справа, напр. «4/9». Пусто — не рисуется. */
  meta?: string;
  tone?: BatchBandTone;
}

const TONE_CLASS: Record<BatchBandTone, string> = {
  accent: styles.accent,
  quiet: styles.quiet,
};

/**
 * Порт `design_ref/components/BatchBand.dc.html` (molecules.json#k050/#k070,
 * «ПОЛОСА ПОРЦИИ» / «ПОЛОСА СЕКЦИИ»).
 * Тонкая заголовочная полоса поверх чертежа: подпись порции/секции слева,
 * счётчик слотов справа. Реестр называет её составленной из атомов `Kicker`,
 * `ToneSurface`, `Counter`, но без переделки ни один не подошёл: `Kicker` и
 * `Counter` красят текст рамповыми тонами хрома (`--color-accent-700`,
 * `--color-neutral-600`), а этой полосе нужны именно чертёжные чернила
 * (`--gu-blueprint-700`, `--gu-muted`) — та же пара, что красит объекты на
 * самом чертеже; ни один из атомов не принимает произвольный цвет снаружи.
 * `ToneSurface` не даёт нейтрально-светлой подложки, которая у полосы
 * постоянна независимо от тона. Текст и разделитель собраны локально на тех
 * же токенах.
 */
const BatchBand = ({ label, meta, tone = 'accent' }: BatchBandProps) => {
  const className = [styles.root, TONE_CLASS[tone]].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <span className={styles.label}>{label}</span>
      {meta && <span className={styles.meta}>{`· ${meta}`}</span>}
    </div>
  );
};

export default BatchBand;
