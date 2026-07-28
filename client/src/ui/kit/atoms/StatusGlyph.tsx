import React from 'react';

import styles from './StatusGlyph.module.css';

export type StatusGlyphStatus = 'fresh' | 'stale' | 'none' | 'ok' | 'run' | 'fail' | 'warn';

export interface StatusGlyphProps {
  status?: StatusGlyphStatus;
  /** Крутится только у `run`, можно выключить. */
  spin?: boolean;
  onDark?: boolean;
  /** Кегль глифа в пикселях. */
  size?: number;
}

const GLYPH: Record<StatusGlyphStatus, string> = {
  fresh: '●',
  stale: '◐',
  none: '○',
  ok: '✓',
  run: '⟳',
  fail: '✗',
  warn: '⚠',
};

const STATUS_CLASS: Record<StatusGlyphStatus, string> = {
  fresh: styles.fresh,
  stale: styles.stale,
  none: styles.none,
  ok: styles.ok,
  run: styles.run,
  fail: styles.fail,
  warn: styles.warn,
};

/**
 * Порт `design_ref/components/StatusGlyph.dc.html` (atoms.json#StatusGlyph).
 * Один и тот же глиф-индикатор на два алфавита: триада свежести
 * (● готово / ◐ устарело / ○ не создано) и триада статуса прогона
 * (✓ готово / ⟳ идёт / ✗ ошибка / ⚠ предупреждение).
 */
const StatusGlyph = ({ status = 'fresh', spin = true, onDark = false, size = 11 }: StatusGlyphProps) => {
  const className = [
    styles.root,
    STATUS_CLASS[status],
    onDark ? styles.onDark : '',
    status === 'run' && spin ? styles.spin : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span role="img" aria-label={status} className={className} style={{ fontSize: `${size}px` }}>
      {GLYPH[status]}
    </span>
  );
};

export default StatusGlyph;
