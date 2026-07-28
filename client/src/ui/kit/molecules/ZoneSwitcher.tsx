import React from 'react';

import DisclosureArrow from '../atoms/DisclosureArrow';
import Kicker from '../atoms/Kicker';
import TextLabel from '../atoms/TextLabel';

import styles from './ZoneSwitcher.module.css';

export interface ZoneSwitcherProps {
  /** Надзаголовок перед значением, напр. «ЗОНА». */
  kickerLabel?: string;
  /** Текущая зона, напр. «1 · Структура». */
  zoneLabel: string;
  /** Список зон раскрыт — стрелка смотрит вниз, а не вбок. */
  open?: boolean;
  onToggle?: () => void;
}

/**
 * Порт `design_ref/components/ZoneSwitcher.dc.html` (molecules.json#k002, «ПЕРЕКЛЮЧАТЕЛЬ ЗОНЫ»).
 * Кнопка-триггер выбора зоны конвейера в шапке шелла: кикер + текущее
 * значение + раскрывающая стрелка внутри волосяной рамки. Живёт только на
 * тёмном хроме студии (как и соседняя ToolbarActions), поэтому onDark не несёт.
 */
const ZoneSwitcher = ({ kickerLabel = 'ЗОНА', zoneLabel, open = false, onToggle }: ZoneSwitcherProps) => {
  const content = (
    <>
      <Kicker text={kickerLabel} onDark size={8.5} />
      <TextLabel text={zoneLabel} onDark bold size={11.5} />
      <DisclosureArrow expanded={open} onDark size={9} />
    </>
  );

  if (!onToggle) {
    return <div className={styles.root}>{content}</div>;
  }

  return (
    <button type="button" className={styles.root} aria-haspopup="listbox" aria-expanded={open} onClick={onToggle}>
      {content}
    </button>
  );
};

export default ZoneSwitcher;
