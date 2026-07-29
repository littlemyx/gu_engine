import React, { useState } from 'react';

import MutedText from '../atoms/MutedText';
import Slider from '../atoms/Slider';

import styles from './VolumeSlider.module.css';

export interface VolumeSliderProps {
  /** Короткая подпись слева от полосы: «vol», «громкость». */
  label: string;
  /** Текущее значение 0–100. Некотролируемый по умолчанию — не пере-задавать на каждый рендер. */
  value?: number;
  onChange?: (value: number) => void;
  /** Строка стоит на тёмном хроме (панель, тулбар). */
  onDark?: boolean;
  disabled?: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Порт `design_ref/components/VolumeSlider.dc.html` (molecules.json#k080,
 * «СЛАЙДЕР ГРОМКОСТИ»).
 * Компактная строка-регулятор: приглушённая подпись слева, трек посередине,
 * моноширинное значение справа. Атом `MonoText` не подошёл для значения —
 * макет красит его акцентным синим (`--color-accent-700`, на тёмном —
 * `--gu-signal-run`), а у `MonoText` из тонов есть только `muted`/`highlight`,
 * без accent (см. тот же обход в `RelationMeter`). Значение поэтому собрано
 * локально на тех же токенах. Заголовок трека у `Slider` скрыт (`showLabel`
 * false): подпись и значение здесь уже стоят по бокам строки.
 */
const VolumeSlider = ({ label, value, onChange, onDark = false, disabled = false }: VolumeSliderProps) => {
  const [local, setLocal] = useState<number | null>(null);
  const val = clamp(local ?? value ?? 50);

  const handleChange = (next: number) => {
    setLocal(next);
    onChange?.(next);
  };

  const labelClassName = [styles.labelSlot, disabled ? styles.dim : ''].filter(Boolean).join(' ');
  const valueClassName = [styles.valueSlot, onDark ? styles.onDark : '', disabled ? styles.dim : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.root}>
      <span className={labelClassName}>
        <MutedText text={label} size={9.5} onDark={onDark} />
      </span>
      <span className={styles.trackSlot}>
        <Slider
          label={label}
          value={val}
          onChange={handleChange}
          onDark={onDark}
          disabled={disabled}
          showLabel={false}
        />
      </span>
      <span className={valueClassName}>{val}</span>
    </div>
  );
};

export default VolumeSlider;
