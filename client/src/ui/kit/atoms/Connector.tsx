import React from 'react';

import styles from './Connector.module.css';

export type ConnectorKind = 'основной' | 'ветвление' | 'маршрут';
export type ConnectorTone = 'accent' | 'нейтральный';

export interface ConnectorProps {
  /** Вид линии: сплошная, пунктирная (ветка) или утолщённая (маршрут). */
  kind?: ConnectorKind;
  tone?: ConnectorTone;
  /** Ломаная линия с одним изломом вместо прямой. */
  elbow?: boolean;
  /** Длина коннектора по горизонтали, px. */
  length?: number;
}

const STROKE_BY_TONE: Record<ConnectorTone, string> = {
  accent: 'var(--color-accent-700)',
  нейтральный: 'var(--color-neutral-400)',
};

/**
 * Порт `design_ref/components/Connector.dc.html` (atoms.json#Connector).
 * SVG-линия связи между узлами чертежа: прямая или с изломом, сплошная
 * или пунктирная (для веток), обычной или утолщённой (для маршрута).
 */
const Connector = ({ kind = 'основной', tone = 'accent', elbow = false, length = 160 }: ConnectorProps) => {
  const height = elbow ? 48 : 12;
  const mid = Math.round(length / 2);
  const d = elbow ? `M 0 ${height - 6} L ${mid} ${height - 6} L ${mid} 6 L ${length} 6` : `M 0 6 L ${length} 6`;
  const strokeWidth = kind === 'маршрут' ? 2.5 : 1.5;
  const strokeDasharray = kind === 'ветвление' ? '4 3' : undefined;

  return (
    <svg className={styles.root} width={length} height={height} aria-hidden="true">
      <path
        d={d}
        stroke={STROKE_BY_TONE[tone]}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
};

export default Connector;
