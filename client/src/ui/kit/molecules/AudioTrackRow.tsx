import React from 'react';

import Glyph from '../atoms/Glyph';
import Timecode from '../atoms/Timecode';

import styles from './AudioTrackRow.module.css';

export interface AudioTrackRowProps {
  /** Имя файла трека, например «тема_главная.mp3». */
  trackName: string;
  /** Таймкод длительности, например «2:14». */
  duration?: string;
  /** Трек сейчас проигрывается. */
  playing?: boolean;
  /** Трек заменён автором вручную (оверрайд авто-генерации). */
  override?: boolean;
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/AudioTrackRow.dc.html` (molecules.json#k028).
 * Строка трека в списке аудио-пакета: глиф проигрывания, имя файла,
 * длительность и, если автора заменили её вручную, пометка «оверрайд».
 * У исходника нет пропа `context` — строка всегда живёт на светлом чертёжном
 * фоне (все цвета мокапа — тёмные чернила для светлой подложки), поэтому
 * `onDark` здесь не нужен, как и в `ArtifactRow` для обратного случая.
 */
const AudioTrackRow = ({
  trackName,
  duration = '2:14',
  playing = false,
  override = false,
  onClick,
}: AudioTrackRowProps) => {
  const nameClassName = [styles.name, override || playing ? styles.nameAccent : '', playing ? styles.namePlaying : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={styles.glyphSlot}>
        <Glyph glyph={playing ? '▶' : '▸'} tone={playing ? 'accent' : 'muted'} size={9} />
      </span>
      <span className={nameClassName}>{trackName}</span>
      <span className={styles.durationSlot}>
        <Timecode value={duration} muted size={9} />
      </span>
      {override && <span className={styles.overrideNote}>· заменён вами (оверрайд)</span>}
    </>
  );

  if (!onClick) {
    return <div className={styles.root}>{content}</div>;
  }

  return (
    <button type="button" className={`${styles.root} ${styles.clickable}`} onClick={onClick}>
      {content}
    </button>
  );
};

export default AudioTrackRow;
