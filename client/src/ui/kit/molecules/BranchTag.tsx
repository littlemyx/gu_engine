import React from 'react';

import Counter from '../atoms/Counter';
import Frame from '../atoms/Frame';
import Kicker from '../atoms/Kicker';

import styles from './BranchTag.module.css';

export type BranchTagTone = 'обычная' | 'активная' | 'тихая';

export interface BranchTagProps {
  /** Название ветки/арки. Регистр и разрядку берёт на себя Kicker. */
  label: string;
  /** Прогресс ветки в процентах. Без значения счётчик не рисуется — как в макете, где `percent < 0` прятал хвост. */
  percent?: number;
  tone?: BranchTagTone;
}

interface ToneConfig {
  frameTone: 'light' | 'accent';
  textTone: 'neutral' | 'accent';
  /** «Активная» ветка получает инсет-рамку Frame — тот же приём, что и выбор. */
  selected: boolean;
  background: string;
}

const TONE_CONFIG: Record<BranchTagTone, ToneConfig> = {
  обычная: { frameTone: 'light', textTone: 'accent', selected: false, background: styles.plain },
  активная: { frameTone: 'accent', textTone: 'accent', selected: true, background: styles.tinted },
  тихая: { frameTone: 'light', textTone: 'neutral', selected: false, background: styles.plain },
};

/**
 * Порт `design_ref/components/BranchTag.dc.html` (molecules.json#k014, «МЕТКА ВЕТКИ»).
 * Метка ветки/арки на карте мира: имя плюс опциональный процент прохождения.
 * Тон кодирует состояние ветки — обычная, активная (выбранная сейчас) или тихая (второстепенная).
 */
const BranchTag = ({ label, percent, tone = 'обычная' }: BranchTagProps) => {
  const config = TONE_CONFIG[tone];

  return (
    <Frame tone={config.frameTone} selected={config.selected} interactive={false} padding={0}>
      <span className={[styles.content, config.background].join(' ')}>
        <Kicker text={label} tone={config.textTone} size={9} />
        {percent !== undefined && (
          <>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <Counter value={`${percent}%`} tone={config.textTone} size={9} />
          </>
        )}
      </span>
    </Frame>
  );
};

export default BranchTag;
