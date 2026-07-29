import React from 'react';

import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';

import styles from './GalleryActions.module.css';

export interface GalleryActionsProps {
  acceptLabel?: string;
  dubLabel?: string;
  /** Смета дубля печатается прямо в подписи контурной кнопки, через « · ». */
  dubPrice?: string;
  disabled?: boolean;
  onAccept?: () => void;
  onDub?: () => void;
}

/**
 * Порт `design_ref/components/GalleryActions.dc.html` (molecules.json#k105).
 * Пара кнопок над карточкой генерации в галерее: залитая «принять этот дубль»
 * рядом с контурной «сделать ещё один дубль», смета дубля вписана в её текст —
 * так же, как исходный `renderVals()` склеивает подпись и цену одной строкой.
 */
const GalleryActions = ({
  acceptLabel = 'Сделать №2 принятым',
  dubLabel = 'Дубль с заметкой',
  dubPrice = '≈$0.08',
  disabled = false,
  onAccept,
  onDub,
}: GalleryActionsProps) => {
  const dubText = dubPrice ? `${dubLabel} · ${dubPrice}` : dubLabel;

  return (
    <div className={styles.root}>
      <PrimaryButton label={acceptLabel} size="compact" marks={false} disabled={disabled} onClick={onAccept} />
      <OutlineButton label={dubText} size="compact" disabled={disabled} onClick={onDub} />
    </div>
  );
};

export default GalleryActions;
