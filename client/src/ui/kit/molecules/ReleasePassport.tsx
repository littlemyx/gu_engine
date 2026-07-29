import React from 'react';

import MonoText from '../atoms/MonoText';

import styles from './ReleasePassport.module.css';

export interface ReleasePassportProps {
  /** Служебные строки паспорта: версия, бандл, QA-отчёт, seed. Каждая — своя строка. */
  lines: string[];
}

/**
 * Порт `design_ref/components/ReleasePassport.dc.html` (molecules.json#k100).
 * Паспорт релиза инспектора: моноширинная карточка на тёмной подложке с
 * ключевыми фактами прогона — версия, бандл, QA-отчёт, seed. Живёт только на
 * тёмном хроме инспектора, поэтому переключателя `onDark` у неё нет.
 */
const ReleasePassport = ({ lines }: ReleasePassportProps) => (
  <div className={styles.root}>
    {lines.map((line, index) => (
      <div key={index} className={styles.line}>
        <MonoText text={line} onDark />
      </div>
    ))}
  </div>
);

export default ReleasePassport;
