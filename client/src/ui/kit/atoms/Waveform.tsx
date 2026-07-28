import React from 'react';

import styles from './Waveform.module.css';

export type WaveformVariant = 'active' | 'muted';

export interface WaveformProps {
  variant?: WaveformVariant;
}

const VARIANT_CLASS: Record<WaveformVariant, string> = {
  active: styles.active,
  muted: styles.muted,
};

/**
 * Порт `design_ref/components/Waveform.dc.html` (atoms.json#Waveform).
 * Полоска-волна дорожки: два слоя repeating-gradient (полная высота + средняя
 * полоса плотнее). `active` — принятый/выбранный дубль, `muted` — прочие.
 * Декоративен, размер задаёт позиционированный родитель — сам заполняет 100%.
 */
const Waveform = ({ variant = 'active' }: WaveformProps) => {
  const variantClass = VARIANT_CLASS[variant];

  return (
    <div className={`${styles.root} ${variantClass}`} aria-hidden="true">
      <span className={styles.outer} />
      <span className={styles.inner} />
    </div>
  );
};

export default Waveform;
