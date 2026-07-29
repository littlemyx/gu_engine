import React from 'react';

import ProgressTrack from '../atoms/ProgressTrack';
import TextLabel from '../atoms/TextLabel';

import styles from './RelationMeter.module.css';

export type RelationMeterTrend = 'рост' | 'спад' | 'нет';

export interface RelationMeterProps {
  /** Имя персонажа, к которому относится шкала. */
  name: string;
  /** Уровень отношений, 0–100. */
  value: number;
  /** Направление динамики: рисует стрелку и красит значение. */
  trend?: RelationMeterTrend;
  /** Метка стоит на тёмном хроме и потому светлеет. */
  onDark?: boolean;
}

const ARROW: Record<RelationMeterTrend, string> = {
  рост: ' ▲',
  спад: ' ▼',
  нет: '',
};

const VALUE_TONE_CLASS: Record<RelationMeterTrend, string> = {
  рост: styles.accent,
  спад: styles.error,
  нет: styles.muted,
};

const clampPercent = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Порт `design_ref/components/RelationMeter.dc.html` (molecules.json#k065,
 * «ШКАЛА ОТНОШЕНИЙ»).
 * Компактная строка-шкала уровня отношений с персонажем: имя слева, полоса
 * прогресса в середине, значение со стрелкой тренда справа. Атом `MonoText`
 * не подошёл для значения — макет красит его в сигнальный тон по тренду
 * (рост → `--gu-signal-run`, спад → `--gu-signal-fail`, нет → приглушённый
 * `--gu-ink-60`/`--gu-muted`), а у `MonoText` из тонов есть только
 * `muted`/`highlight`, без accent/error. Значение поэтому собрано локально
 * моноширинным шрифтом `--gu-mono` на тех же токенах, которыми пользуется
 * `TextLabel.tone` для accent/error/muted.
 */
const RelationMeter = ({ name, value, trend = 'рост', onDark = false }: RelationMeterProps) => {
  const clampedValue = clampPercent(value);
  const valueText = `${clampedValue}${ARROW[trend]}`;

  const valueClassName = [styles.value, VALUE_TONE_CLASS[trend], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.root}>
      <span className={styles.name}>
        <TextLabel text={name} size={10.5} onDark={onDark} />
      </span>
      <span className={styles.track}>
        <ProgressTrack value={clampedValue} showLabel={false} size="thin" onDark={onDark} />
      </span>
      <span className={valueClassName}>{valueText}</span>
    </div>
  );
};

export default RelationMeter;
