import React, { useState } from 'react';

import Frame from '../atoms/Frame';
import MonoText from '../atoms/MonoText';
import Slider from '../atoms/Slider';
import TextLabel from '../atoms/TextLabel';

import styles from './FxParam.module.css';

export interface FxParamProps {
  /** Название FX-параметра: «реверб», «дилэй». */
  label: string;
  /** Текущее значение 0–100. Некотролируемый по умолчанию — не пере-задавать на каждый рендер. */
  value?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Порт `design_ref/components/FxParam.dc.html` (molecules.json#k082,
 * «РЕГУЛЯТОР FX · ИНСПЕКТОР»).
 * Регулятор FX-параметра в инспекторе: подпись и процентное значение над
 * hairline-треком в тонкой рамке. У исходника нет пропа `context` — все цвета
 * мокапа жёстко заданы под тёмный хром (ink-подписи, sign-run заливка трека),
 * поэтому составляющие атомы (`TextLabel`, `MonoText`, `Slider`, `Frame`)
 * всегда рендерятся в тёмном варианте, отдельный `onDark` не заведён.
 */
const FxParam = ({ label, value = 18, disabled = false, onChange }: FxParamProps) => {
  const [local, setLocal] = useState<number | null>(null);
  const val = clamp(local ?? value);

  const handleChange = (next: number) => {
    setLocal(next);
    onChange?.(next);
  };

  return (
    <div className={disabled ? `${styles.root} ${styles.disabled}` : styles.root}>
      <Frame tone="dark" interactive={false} paddingX={8} paddingY={6} block>
        <div className={styles.header}>
          <TextLabel text={label} onDark size={10.5} />
          <MonoText text={`${val}%`} onDark size={10.5} />
        </div>
        <Slider label={label} value={val} onChange={handleChange} disabled={disabled} onDark showLabel={false} />
      </Frame>
    </div>
  );
};

export default FxParam;
