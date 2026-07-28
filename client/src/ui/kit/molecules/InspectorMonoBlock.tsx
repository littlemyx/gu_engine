import React from 'react';

import MonoText from '../atoms/MonoText';

import styles from './InspectorMonoBlock.module.css';

export interface InspectorMonoBlockProps {
  /** Служебные строки: провенанс, ссылка на каст, seed+лог. Каждая — своя строка. */
  lines: string[];
  onDark?: boolean;
  /** Волосяная рамка и внутренние отступы вокруг блока. */
  framed?: boolean;
  /** Ширина блока, px. Не задано — блок растягивается на всю доступную ширину. */
  width?: number;
}

/**
 * Порт `design_ref/components/InspectorMonoBlock.dc.html` (molecules.json#s004).
 * Моно-блок инспектора: построчный служебный вывод (провенанс, CastRef,
 * seed+лог) моноширинным шрифтом, опционально в волосяной рамке.
 */
const InspectorMonoBlock = ({ lines, onDark = true, framed = true, width }: InspectorMonoBlockProps) => {
  const className = [styles.root, onDark ? styles.onDark : '', framed ? styles.framed : ''].filter(Boolean).join(' ');

  const style: React.CSSProperties = { width: width ? `${width}px` : '100%' };

  return (
    <div className={className} style={style}>
      {lines.map((line, index) => (
        <div key={index} className={styles.line}>
          <MonoText text={line} onDark={onDark} muted size={9.5} />
        </div>
      ))}
    </div>
  );
};

export default InspectorMonoBlock;
