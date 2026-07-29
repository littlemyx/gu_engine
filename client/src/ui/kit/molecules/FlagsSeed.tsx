import React from 'react';

import MonoText from '../atoms/MonoText';
import StatusGlyph from '../atoms/StatusGlyph';

import styles from './FlagsSeed.module.css';

export interface FlagsSeedFlag {
  /** Имя флага, как оно лежит в состоянии: `storm_seen`, `kira_secret`. */
  id: string;
  /** Выставлен ли флаг: ✓, если да, «—», если ещё не сработал. */
  active: boolean;
}

export interface FlagsSeedProps {
  /** Подпись перед списком флагов. */
  flagsLabel?: string;
  flags: FlagsSeedFlag[];
  /** Строка сида целиком: значение + примечание, одна строка вывода. */
  seedLabel: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/FlagsSeed.dc.html` (molecules.json#FlagsSeed).
 * Служебная строка отладки: какие флаги истории выставлены и каким seed'ом
 * идёт детерминированный прогон. Живёт в статус-баре поверх тёмного хрома.
 */
const FlagsSeed = ({ flagsLabel = 'флаги:', flags, seedLabel, onDark = false }: FlagsSeedProps) => {
  const rootClassName = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const dashClassName = [styles.dash, onDark ? styles.dashOnDark : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <div className={styles.body}>
        <div className={styles.line}>
          <MonoText text={flagsLabel} muted onDark={onDark} size={9.5} />
          {flags.map((flag, index) => (
            <span className={styles.flagItem} key={flag.id}>
              {index > 0 && <span className={styles.sep}>·</span>}
              <MonoText text={flag.id} muted onDark={onDark} size={9.5} />
              {flag.active ? (
                <StatusGlyph status="ok" onDark={onDark} size={9.5} spin={false} />
              ) : (
                <span className={dashClassName}>—</span>
              )}
            </span>
          ))}
        </div>
        <div className={styles.line}>
          <MonoText text={seedLabel} muted onDark={onDark} size={9.5} />
        </div>
      </div>
    </div>
  );
};

export default FlagsSeed;
