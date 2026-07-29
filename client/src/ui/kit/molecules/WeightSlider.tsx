import React, { useState } from 'react';

import Kicker from '../atoms/Kicker';
import MonoText from '../atoms/MonoText';
import Slider from '../atoms/Slider';

import styles from './WeightSlider.module.css';

export interface WeightSliderProps {
  /** Подпись слайдера: имя веса/параметра («агрессия», «громкость»). */
  label: string;
  /** Текущее значение 0–100. Некотролируемый по умолчанию — не пере-задавать на каждый рендер. */
  value?: number;
  onChange?: (value: number) => void;
  /** Строка значения над треком; по умолчанию — число текущего значения. */
  valueText?: string;
  onDark?: boolean;
  disabled?: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Порт `design_ref/components/WeightSlider.dc.html` (molecules.json#p008,
 * «СЛАЙДЕР ВЕСА С ПОДПИСЬЮ»).
 * Строка настройки веса: капслок-лейбл (`Kicker`) и моно-значение (`MonoText`)
 * в шапке, трек (`Slider`) снизу — собственный заголовок `Slider` отключён
 * (`showLabel={false}`), т.к. молекула строит его сама из двух других атомов.
 */
const WeightSlider = ({ label, value, onChange, valueText, onDark = false, disabled = false }: WeightSliderProps) => {
  const [local, setLocal] = useState<number | null>(null);
  const val = clamp(local ?? value ?? 50);

  const handleChange = (next: number) => {
    setLocal(next);
    onChange?.(next);
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Kicker text={label} onDark={onDark} />
        <MonoText text={valueText ?? String(val)} onDark={onDark} />
      </div>
      <Slider label={label} value={val} onChange={handleChange} showLabel={false} onDark={onDark} disabled={disabled} />
    </div>
  );
};

export default WeightSlider;
