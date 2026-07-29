import React from 'react';

import Counter from '../atoms/Counter';
import Heading from '../atoms/Heading';
import ProgressTrack from '../atoms/ProgressTrack';
import Shadow from '../atoms/Shadow';
import StatusGlyph from '../atoms/StatusGlyph';
import TextLabel from '../atoms/TextLabel';

import styles from './RunOverlayCard.module.css';

export type RunOverlayPhaseStatus = 'done' | 'current' | 'waiting';

export interface RunOverlayPhaseItem {
  /** Название фазы без глифа статуса — глиф рисует статус. */
  label: string;
  /** Значение справа: смета, счётчик слотов, «≈ $0.06» и т. п. */
  value: string;
  status: RunOverlayPhaseStatus;
}

export interface RunOverlayCardProps {
  title: string;
  phases: RunOverlayPhaseItem[];
  /** 0–100, зажимается в диапазон внутри `ProgressTrack`. */
  percent: number;
  /** Ширина карточки, px (200–360 в макете). */
  width?: number;
}

/**
 * Порт `design_ref/components/RunOverlayCard.dc.html` (molecules.json#p031,
 * «КАРТОЧКА ПРОГОНА ПОВЕРХ ВЬЮПОРТА»). Плавающая карточка со списком фаз
 * прогона и общей полосой прогресса; текущая фаза подсвечена заливкой и
 * жирным подписью. Два атома из реестра не подошли без переделки:
 * `Frame` не несёт тона рамки `--color-accent-700` (только общий `accent` =
 * `--color-accent`) — рамка карточки, как и в `ModalFrame`, собрана локально
 * на нужном токене напрямую. `ToneSurface` — `display:inline-block` без
 * варианта на всю ширину, а строке с `justify-content:space-between` нужен
 * растянутый на 100% фон — подсветка текущей строки сделана локально на том
 * же токене `--color-accent-100`, которым красит `ToneSurface` тон `accent`.
 * У `StatusGlyph` нет глифа для статуса «ожидает» (в макете — «·», ближайший
 * по смыслу `none` рисует другую форму, «○»), поэтому для «ожидает» глиф
 * макета оставлен литералом — так же, как в ките остаются фиксированные
 * глифы вроде «✓» и «▾».
 */
const RunOverlayCard = ({ title, phases, percent, width = 240 }: RunOverlayCardProps) => {
  return (
    <Shadow size="md">
      <div className={styles.root} style={{ width: `${width}px` }}>
        <div className={styles.heading}>
          <Heading text={title} level="card" />
        </div>
        <div className={styles.rows}>
          {phases.map((phase, index) => {
            const isCurrent = phase.status === 'current';
            const isWaiting = phase.status === 'waiting';
            const rowClass = [styles.row, isCurrent ? styles.rowCurrent : ''].filter(Boolean).join(' ');

            return (
              <div className={isCurrent ? styles.rowCurrentWrap : undefined} key={`${index}-${phase.label}`}>
                <div className={rowClass}>
                  <span className={styles.rowLeft}>
                    {isWaiting ? (
                      <span className={styles.waitingGlyph} aria-hidden="true">
                        ·
                      </span>
                    ) : (
                      <StatusGlyph status={phase.status === 'done' ? 'ok' : 'run'} size={10.5} />
                    )}
                    <TextLabel text={phase.label} size={10.5} bold={isCurrent} tone={isWaiting ? 'muted' : 'normal'} />
                  </span>
                  {isCurrent ? (
                    <TextLabel text={phase.value} size={10.5} tone="normal" />
                  ) : (
                    <Counter value={phase.value} tone="neutral" font="body" size={10.5} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.progress}>
          <ProgressTrack value={percent} showLabel={false} size="thin" />
        </div>
      </div>
    </Shadow>
  );
};

export default RunOverlayCard;
