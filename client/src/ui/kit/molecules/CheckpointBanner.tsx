import React from 'react';

import Glyph from '../atoms/Glyph';
import MutedText from '../atoms/MutedText';
import OutlineButton, { type OutlineButtonTone } from '../atoms/OutlineButton';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './CheckpointBanner.module.css';

export type CheckpointBannerTone = 'default' | 'warn';

export interface CheckpointBannerProps {
  /** Ведущий символ-иконка перед подписью: ⏸, ▶, ⛔ и т.п. */
  glyph?: string;
  /** Основная подпись — что произошло/что включено. */
  label: string;
  /** Служебное пояснение справа от подписи. */
  note: string;
  tone?: CheckpointBannerTone;
  /** Подпись кнопки действия. Без неё и без `onAction` кнопка не рисуется. */
  action?: string;
  actionTone?: OutlineButtonTone;
  onAction?: () => void;
}

/**
 * Порт `design_ref/components/CheckpointBanner.dc.html` (molecules.json#k052,
 * «БАННЕР ЧЕКПОИНТА»).
 * Полоса-уведомление о состоянии конвейера (пауза, чекпоинт) с необязательным
 * быстрым действием справа. Собрана из `ToneSurface` (подложка), `Glyph` и
 * `TextLabel` (подпись), `MutedText` (пояснение) и `OutlineButton` (действие);
 * верхняя цветная черта и построчный флекс — своя разметка, которой нет в
 * пропсах атома-подложки.
 */
const CheckpointBanner = ({
  glyph = '⏸',
  label,
  note,
  tone = 'default',
  action,
  actionTone = 'neutral',
  onAction,
}: CheckpointBannerProps) => {
  const warn = tone === 'warn';
  const hasAction = Boolean(action);

  const rootClassName = [styles.root, warn ? styles.warn : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <ToneSurface tone={warn ? 'warn' : 'accent'} padding={0}>
        <div className={styles.row}>
          <Glyph glyph={glyph} tone={warn ? 'warn' : 'accent'} size={13} />
          <span className={styles.label}>
            <TextLabel text={label} bold size={12} />
          </span>
          <span className={styles.note}>
            <MutedText text={note} size={11.5} />
          </span>
          {hasAction && action ? (
            <OutlineButton label={action} tone={actionTone} size="compact" onClick={onAction} />
          ) : null}
        </div>
      </ToneSurface>
    </div>
  );
};

export default CheckpointBanner;
