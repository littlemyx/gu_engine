import React from 'react';

import MonoText from '../atoms/MonoText';
import ProgressTrack from '../atoms/ProgressTrack';

import styles from './RunProgress.module.css';

export type RunProgressTone = 'loading' | 'error';

export interface RunProgressProps {
  /** 0–100, атом сам зажимает в диапазон. */
  percent: number;
  /** Строка счёта прогона: «14 из 26 · $0.41». */
  label: string;
  tone?: RunProgressTone;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/RunProgress.dc.html` (molecules.json#k046,
 * «ПРОГРЕСС-БАР ПРОГОНА»). Компактная строка прогона: тулбарный
 * трек `ProgressTrack` без своей подписи + счёт прогона моноширинным текстом
 * рядом — виджет для статус-бара и панели действий конвейера.
 */
const RunProgress = ({ percent, label, tone = 'loading', onDark = false }: RunProgressProps) => {
  return (
    <div className={styles.root}>
      <div className={styles.track}>
        <ProgressTrack value={percent} showLabel={false} size="toolbar" tone={tone} onDark={onDark} />
      </div>
      <MonoText text={label} onDark={onDark} muted size={11} />
    </div>
  );
};

export default RunProgress;
