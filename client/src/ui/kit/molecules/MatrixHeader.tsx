import React from 'react';

import Heading from '../atoms/Heading';
import MutedText from '../atoms/MutedText';
import Divider from '../atoms/Divider';
import AccentText from '../atoms/AccentText';

import styles from './MatrixHeader.module.css';

export interface MatrixHeaderDay {
  /** Подпись дня, например «День 1» или «Д4 ◈». */
  name: string;
}

export interface MatrixHeaderProps {
  /** Дни матрицы слева направо. */
  days: MatrixHeaderDay[];
  /** Номер активного дня, 1-based; 0 — ни один день не подсвечен. */
  activeDay?: number;
  /** Подписи фаз внутри дня, циклически на все дни (по умолчанию «у, д, в»). */
  phaseLabels?: string[];
  /** Сколько фазовых колонок приходится на один день. */
  phasesPerDay?: number;
  /** Ширина одной фазовой колонки, px. */
  slotWidth?: number;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/MatrixHeader.dc.html` (molecules.json#p022).
 * Двухрядная шапка матрицы дней: верхний ряд — названия дней (активный
 * подсвечен акцентом), нижний — подписи фаз внутри каждого дня. Ряды не
 * компонуются из реестра `dcRefs` (он пуст у источника) — состав атомов взят
 * из карточки молекулы и подобран по смыслу.
 */
const MatrixHeader = ({
  days,
  activeDay = 0,
  phaseLabels = ['у', 'д', 'в'],
  phasesPerDay = 3,
  slotWidth = 33,
  onDark = false,
}: MatrixHeaderProps) => {
  const perDay = Math.max(1, Math.floor(phasesPerDay));
  const columns = days.length * perDay;

  const phases: string[] = [];
  for (let i = 0; i < days.length; i += 1) {
    for (let j = 0; j < perDay; j += 1) {
      phases.push(phaseLabels[j % phaseLabels.length] ?? '');
    }
  }

  return (
    <div className={styles.root} style={{ gridTemplateColumns: `repeat(${columns}, ${slotWidth}px)` }}>
      {days.map((day, index) => {
        const dayNumber = index + 1;
        const isActive = dayNumber === activeDay;
        const start = index * perDay + 1;
        const end = start + perDay;

        return (
          <span
            key={`day-${index}-${day.name}`}
            className={styles.dayCell}
            style={{ gridColumn: `${start} / ${end}`, gridRow: 1 }}
          >
            <Divider orientation="vertical" onDark={onDark} length={14} />
            <span className={styles.dayLabel}>
              {isActive ? (
                <AccentText text={day.name} tone="accent" bold size={11} onDark={onDark} />
              ) : (
                <Heading text={day.name} size={11} onDark={onDark} />
              )}
            </span>
          </span>
        );
      })}
      {phases.map((phase, index) => (
        <span key={`phase-${index}`} className={styles.phaseCell} style={{ gridColumn: index + 1, gridRow: 2 }}>
          <MutedText text={phase} quiet size={9} onDark={onDark} />
        </span>
      ))}
    </div>
  );
};

export default MatrixHeader;
