import React from 'react';

import Frame from '../atoms/Frame';
import Letterform from '../atoms/Letterform';
import MutedText from '../atoms/MutedText';
import ProgressTrack from '../atoms/ProgressTrack';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './VariantCard.module.css';

export interface VariantCardProps {
  /** Литера варианта: A, B, С3. */
  letter?: string;
  /** Подпись варианта (хронометраж, настроение и т.п.). */
  label: string;
  /** Идёт прослушивание/просмотр варианта; влияет на статус и полосу прогресса. */
  playing?: boolean;
  /** Прогресс воспроизведения, 0–100. Осмыслен только при `playing`. */
  progress?: number;
  onDark?: boolean;
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/VariantCard.dc.html` (molecules.json#k075).
 * Карточка варианта A/B в партитуре: литера, подпись и статус
 * играет/ждёт — с мигающим курсором и полосой прогресса во время
 * воспроизведения, тихой меткой «слушать» в покое.
 */
const VariantCard = ({
  letter = 'A',
  label,
  playing = true,
  progress = 34,
  onDark = false,
  onClick,
}: VariantCardProps) => {
  const content = (
    <>
      <div className={styles.row}>
        <Letterform letter={letter} variant="outline" size={20} onDark={onDark} />
        <span className={styles.label}>
          <TextLabel text={label} onDark={onDark} size={10.5} />
        </span>
        <span className={styles.status}>
          {playing ? (
            <ToneSurface tone="accent" padding={2}>
              <span className={styles.statusInner}>
                <TextLabel text="играет" onDark={onDark} tone="accent" bold size={9.5} />
                <span className={styles.cursor} aria-hidden="true">
                  {' '}
                  ▌
                </span>
              </span>
            </ToneSurface>
          ) : (
            <MutedText text="слушать" onDark={onDark} size={9.5} />
          )}
        </span>
      </div>
      {playing && (
        <div className={styles.progress}>
          <ProgressTrack value={progress} showLabel={false} size="thin" onDark={onDark} />
        </div>
      )}
    </>
  );

  return (
    <Frame
      tone={onDark ? 'dark' : 'light'}
      interactive={Boolean(onClick)}
      block
      paddingX={10}
      paddingY={8}
      onClick={onClick}
    >
      {content}
    </Frame>
  );
};

export default VariantCard;
