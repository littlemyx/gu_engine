import React from 'react';

import Segment from '../atoms/Segment';

import styles from './SectionSegments.module.css';

export interface SectionSegmentsItem {
  label: string;
}

export interface SectionSegmentsProps {
  /** Разделы слева направо, напр. «Акты», «Персонажи», «Мир». */
  sections: SectionSegmentsItem[];
  /** Метка активного раздела; по умолчанию — первый раздел списка. */
  active?: string;
  onPick?: (section: string) => void;
}

/**
 * Порт `design_ref/components/SectionSegments.dc.html` (molecules.json#k005, «СЕГМЕНТ РАЗДЕЛОВ»).
 * Ряд разделов-переключателей на тёмном хроме студии: каждая опция — атом
 * `Segment` (заливка несёт выбор), а внешняя тёмная подложка и фиксированная
 * ширина из макета — обвязка превью дизайн-тула, а не часть компонента.
 */
const SectionSegments = ({ sections, active, onPick }: SectionSegmentsProps) => {
  const activeLabel = active ?? sections[0]?.label;

  return (
    <div className={styles.root}>
      {sections.map(section => (
        <Segment
          key={section.label}
          label={section.label}
          selected={section.label === activeLabel}
          onDark
          onClick={onPick ? () => onPick(section.label) : undefined}
        />
      ))}
    </div>
  );
};

export default SectionSegments;
