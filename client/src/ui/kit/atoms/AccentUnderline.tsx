import React from 'react';

import styles from './AccentUnderline.module.css';

export interface AccentUnderlineProps {
  label: string;
  /** Подложка под меткой; выключается, когда акцентную полосу нужно посадить прямо на фон. */
  withBg?: boolean;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/AccentUnderline.dc.html` (atoms.json#AccentUnderline).
 * 2px акцентная полоса (inset box-shadow) под меткой — маркер активной вкладки.
 */
const AccentUnderline = ({ label, withBg = true, onDark = false }: AccentUnderlineProps) => {
  const className = [styles.root, withBg ? styles.withBg : '', onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return <span className={className}>{label}</span>;
};

export default AccentUnderline;
