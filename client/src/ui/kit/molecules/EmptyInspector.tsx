import React from 'react';

import MutedText from '../atoms/MutedText';

import styles from './EmptyInspector.module.css';

export interface EmptyInspectorProps {
  /** Строки плейсхолдера, сверху вниз. В макете — заголовок и пояснение. */
  lines: string[];
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/EmptyInspector.dc.html` (molecules.json#p044, «ПУСТОЙ ИНСПЕКТОР»).
 * Заглушка инспектора, когда ничего не выбрано: центрированный приглушённый текст
 * на всю доступную область панели.
 */
const EmptyInspector = ({ lines, onDark = false }: EmptyInspectorProps) => {
  const className = [styles.root, onDark ? styles.onDark : styles.onLight].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <div className={styles.body}>
        {lines.map((line, index) => (
          <div key={index}>
            <MutedText text={line} onDark={onDark} quiet size={11.5} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmptyInspector;
