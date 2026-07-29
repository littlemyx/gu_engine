import React from 'react';

import Frame from '../atoms/Frame';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './RadioCard.module.css';

export interface RadioCardProps {
  /** Заголовок варианта: «Пустой проект», «Из шаблона». */
  title: string;
  /** Пояснение под заголовком. */
  desc: string;
  selected?: boolean;
  /** Без колбэка карточка — немой индикатор состояния, не интерактивный контрол. */
  onSelect?: () => void;
}

/**
 * Порт `design_ref/components/RadioCard.dc.html` (molecules.json#p013).
 * Карточка-радио: один вариант из списка (шаблон проекта и т.п.), выбираемый
 * кликом по всей строке, а не только по кружку. Кружок рисуется локально —
 * атом `Radio` сам несёт `role="radio"` на своей обёртке, и вложить его в
 * карточку с тем же role не выйдет без задвоения семантики (как и в
 * `TrackRow`, который по той же причине не берёт `Radio` для своей дорожки).
 */
const RadioCard = ({ title, desc, selected = false, onSelect }: RadioCardProps) => {
  const content = (
    <>
      <span className={[styles.dial, selected ? styles.dialChecked : ''].filter(Boolean).join(' ')} aria-hidden="true">
        {selected && <span className={styles.dot} />}
      </span>
      <span className={styles.body}>
        <TextLabel text={title} bold />
        <MutedText text={desc} size={10} />
      </span>
    </>
  );

  const surfaceClassName = [styles.surface, onSelect ? styles.clickable : ''].filter(Boolean).join(' ');

  const surface = onSelect ? (
    <button type="button" className={surfaceClassName} role="radio" aria-checked={selected} onClick={onSelect}>
      {content}
    </button>
  ) : (
    <span className={surfaceClassName} role="radio" aria-checked={selected}>
      {content}
    </span>
  );

  const toned = selected ? (
    <span className={styles.toneStretch}>
      <ToneSurface tone="accent" padding={0}>
        {surface}
      </ToneSurface>
    </span>
  ) : (
    surface
  );

  return (
    <Frame tone="light" selected={selected} interactive={false} padding={0} block>
      {toned}
    </Frame>
  );
};

export default RadioCard;
