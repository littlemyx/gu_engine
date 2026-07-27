import React, { useState } from 'react';

import styles from '../panels/panels.module.css';

export interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Сворачиваемая секция инспектора: «▾ Замки», «▾ Исходы», «▾ Медиа». */
const Section = ({ title, defaultOpen = true, children }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button type="button" className={styles.sectionHead} onClick={() => setOpen(o => !o)}>
        <span>{open ? '▾' : '▸'}</span>
        <span>{title}</span>
      </button>
      {open && children}
    </div>
  );
};

export interface FieldProps {
  name: string;
  children: React.ReactNode;
  mono?: boolean;
}

export const Field = ({ name, children, mono = false }: FieldProps) => (
  <div className={styles.field}>
    <span className={styles.fieldName}>{name}</span>
    <span className={`${styles.fieldValue} ${mono ? styles.mono : ''}`}>{children}</span>
  </div>
);

export default Section;
