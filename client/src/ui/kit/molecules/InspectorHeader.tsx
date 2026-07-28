import React from 'react';

import Heading from '../atoms/Heading';
import Kicker from '../atoms/Kicker';

import styles from './InspectorHeader.module.css';

export interface InspectorHeaderProps {
  /** Путь/код секции над заголовком, например «ИНСПЕКТОР · beat_prose / b5». */
  kicker: string;
  title: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/InspectorHeader.dc.html` (molecules.json#s011).
 * Шапка панели инспектора: кикер-путь над condensed-заголовком. Общий верх
 * для любой вкладки инспектора студии — только тексты и режим хрома, без
 * собственной логики.
 */
const InspectorHeader = ({ kicker, title, onDark = false }: InspectorHeaderProps) => (
  <div className={styles.root}>
    <Kicker text={kicker} tone="neutral" onDark={onDark} size={8.5} />
    <Heading text={title} uppercase={false} onDark={onDark} size={15} />
  </div>
);

export default InspectorHeader;
