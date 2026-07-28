import React from 'react';

import styles from './DashedFrame.module.css';

export type DashedFrameKind = 'add' | 'note' | 'missing';

export interface DashedFrameProps {
  kind?: DashedFrameKind;
  onDark?: boolean;
  /** Фокусируемость и hover-отклик рамки; по умолчанию включена у `add`, выключена у прочих видов. */
  interactive?: boolean;
  padding?: number;
  children?: React.ReactNode;
}

const KIND_CLASS: Record<DashedFrameKind, string> = {
  add: styles.add,
  note: styles.note,
  missing: styles.missing,
};

/**
 * Порт `design_ref/components/DashedFrame.dc.html` (atoms.json#DashedFrame).
 * Пунктирный контур для мест, ждущих действия: add-зона, заметка режиссёру,
 * недостающие данные. Сама по себе некликабельна — клик вешает обёртка молекулы.
 */
const DashedFrame = ({ kind = 'add', onDark = false, interactive, padding = 12, children }: DashedFrameProps) => {
  const isInteractive = interactive ?? kind === 'add';
  const className = [
    styles.root,
    KIND_CLASS[kind],
    onDark ? styles.onDark : '',
    isInteractive ? styles.interactive : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} style={{ padding: `${padding}px` }} tabIndex={isInteractive ? 0 : undefined}>
      {children}
    </div>
  );
};

export default DashedFrame;
