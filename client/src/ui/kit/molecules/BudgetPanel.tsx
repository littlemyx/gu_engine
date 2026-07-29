import React from 'react';

import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import ProgressTrack from '../atoms/ProgressTrack';
import TextLabel from '../atoms/TextLabel';

import styles from './BudgetPanel.module.css';

export interface BudgetPanelRow {
  /** Подпись строки: «потрачено», «оценка до конца», «лимит прогона». */
  label: string;
  /** Значение строки, обычно денежная сумма: «$0.21», «≈ $0.31». */
  value: string;
  /** Приглушённая строка (в макете — «лимит прогона») — тише основного текста. */
  muted?: boolean;
}

export interface BudgetPanelProps {
  rows: BudgetPanelRow[];
  /** Заполнение трека, 0–100. */
  percent: number;
  /** Позиция метки-лимита на треке, 0–100. */
  limitAt: number;
  /** Пояснительная строка под треком: риск превышения, авто-стоп. */
  note: string;
  /** Панель стоит на тёмном хроме инспектора — умолчание макета. */
  onDark?: boolean;
  /** Ширина обёртки, px. */
  width?: number;
}

/**
 * Порт `design_ref/components/BudgetPanel.dc.html` (molecules.json#p032).
 * Панель бюджета прогона: построчный расход (потрачено / оценка / лимит),
 * трек прогресса с меткой-лимитом и приглушённая заметка про авто-стоп.
 */
const BudgetPanel = ({ rows, percent, limitAt, note, onDark = true, width = 320 }: BudgetPanelProps) => {
  const rootClass = [styles.root, onDark ? styles.onDark : styles.onLight].join(' ');

  return (
    <div className={rootClass} style={{ width: `${width}px` }}>
      <div className={styles.body}>
        {rows.map((row, index) => (
          <div className={styles.row} key={`${row.label}-${index}`}>
            <span className={styles.label}>
              {row.muted ? (
                <MutedText text={row.label} onDark={onDark} size={11.5} />
              ) : (
                <TextLabel text={row.label} onDark={onDark} size={11.5} />
              )}
            </span>
            <span className={styles.value}>
              <MonoText text={row.value} onDark={onDark} muted={row.muted} size={11.5} />
            </span>
          </div>
        ))}
        <div className={styles.track}>
          <ProgressTrack value={percent} limit={limitAt} showLabel={false} size="thin" onDark={onDark} />
        </div>
        <MutedText text={note} onDark={onDark} quiet size={10} />
      </div>
    </div>
  );
};

export default BudgetPanel;
