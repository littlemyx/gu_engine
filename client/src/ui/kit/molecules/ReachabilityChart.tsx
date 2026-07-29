import React from 'react';

import CornerMarks from '../atoms/CornerMarks';
import Kicker from '../atoms/Kicker';
import TextLabel from '../atoms/TextLabel';

import styles from './ReachabilityChart.module.css';

export type ReachabilityRowTone = 'default' | 'warn' | 'quiet';

export interface ReachabilityRow {
  /** Название концовки/ветки. */
  label: string;
  /** Доля прогонов, дошедших до неё, 0–100 — ширина полосы. */
  percent: number;
  /** Текст справа от полосы, обычно число прогонов. */
  count: string;
  /** `warn` — редко достижимая концовка, требует внимания автора; `quiet` — приглушённая, не тревожная. */
  tone?: ReachabilityRowTone;
}

export interface ReachabilityChartProps {
  /** Заголовок-кикер над списком, напр. «ДОСТИЖИМОСТЬ КОНЦОВОК · 50 ПРОГОНОВ». */
  title: string;
  rows: ReachabilityRow[];
}

const LABEL_TONE: Record<ReachabilityRowTone, 'normal' | 'muted'> = {
  default: 'normal',
  warn: 'muted',
  quiet: 'normal',
};

const FILL_CLASS: Record<ReachabilityRowTone, string> = {
  default: styles.fillDefault,
  warn: styles.fillWarn,
  quiet: styles.fillQuiet,
};

const COUNT_CLASS: Record<ReachabilityRowTone, string> = {
  default: styles.countDefault,
  warn: styles.countWarn,
  quiet: styles.countQuiet,
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/**
 * Порт `design_ref/components/ReachabilityChart.dc.html` (molecules.json#k087,
 * «ШКАЛА ДОСТИЖИМОСТИ (БЛЮПРИНТ-КАРТА)»).
 * Блюпринт-карточка с рядами достижимости концовок по итогам прогонов —
 * подпись слева, полоса доли посередине, число прогонов моноширинным
 * шрифтом справа. Тон строки красит и полосу, и число разом: `warn» — редко
 * достижимая концовка (серая полоса, приглушённая подпись, тревожное число),
 * `quiet` — приглушённая полоса без тревоги. У исходника нет пропа
 * `context`: все цвета мокапа — тёмные чернила на светлой/чертёжной
 * подложке, поэтому `onDark` не нужен (как в `AudioTrackRow`/`ArtifactRow`).
 * Проп `width` из секции «Превью» дизайна — обвязка редактора, не перенесён.
 */
const ReachabilityChart = ({ title, rows }: ReachabilityChartProps) => {
  return (
    <CornerMarks tone="plain">
      <div className={styles.frame}>
        <Kicker text={title} tone="neutral" size={9} />
        <div className={styles.rows}>
          {rows.map((row, index) => {
            const tone = row.tone ?? 'default';
            const clampedPercent = clampPercent(row.percent);

            return (
              <div key={index} className={styles.row}>
                <span className={styles.label}>
                  <TextLabel text={row.label} size={10.5} tone={LABEL_TONE[tone]} />
                </span>
                <span
                  className={styles.track}
                  role="progressbar"
                  aria-label={row.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={clampedPercent}
                >
                  <span className={`${styles.fill} ${FILL_CLASS[tone]}`} style={{ width: `${clampedPercent}%` }} />
                </span>
                <span className={`${styles.count} ${COUNT_CLASS[tone]}`}>{row.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </CornerMarks>
  );
};

export default ReachabilityChart;
