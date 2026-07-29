import React from 'react';

import AccentText from '../atoms/AccentText';
import Chip from '../atoms/Chip';
import Frame from '../atoms/Frame';
import Kicker from '../atoms/Kicker';
import MonoText from '../atoms/MonoText';
import Playhead from '../atoms/Playhead';
import Slider from '../atoms/Slider';
import Waveform, { type WaveformVariant } from '../atoms/Waveform';

import styles from './MixTrackRow.module.css';

export type MixTrackRowWave = WaveformVariant;
export type MixTrackRowNoteSide = 'left' | 'right';

export interface MixTrackRowProps {
  /** Надзаголовок над именем дорожки, например «МУЗЫКА». */
  kicker: string;
  /** Имя файла/дорожки, моноширинным. */
  track: string;
  /** Строка под именем: тейк, статус, цена — например «тейк A · принят · $0.12». */
  take: string;
  /**
   * Плотность волны: `active` — двойная, принятый/выбранный дубль,
   * `muted` — узкая, прочие дубли. Игнорируется, если передан `children`.
   */
  wave?: MixTrackRowWave;
  /** Свой контент вместо волны (например клипы SFX) — заменяет `Waveform` целиком. */
  children?: React.ReactNode;
  /** Позиция плейхеда над волной, 0–100%. */
  playhead?: number;
  /** Дорожка выделена/активна — акцентная рамка строки. */
  active?: boolean;
  /** Заметка поверх волны — тайминг, комментарий. */
  note?: string;
  noteSide?: MixTrackRowNoteSide;
  /** Громкость дорожки, 0–100. */
  volume?: number;
  onVolumeChange?: (value: number) => void;
  /** Ряд FX-тегов дорожки, например `['reverb 18%', 'lowpass 4k']`. */
  fx?: string[];
  /** Подпись кнопки добавления FX без «+» — префикс рисует сам `Chip`. */
  fxAddLabel?: string;
  onFxAdd?: () => void;
  /** Клик по левой инфо-колонке (кикер · имя · тейк). */
  onClick?: () => void;
}

/**
 * Порт `design_ref/components/MixTrackRow.dc.html` (molecules.json#k078,
 * «ДОРОЖКА МИКСА · ЛЕЙБЛ + ВОЛНА + РЕГУЛЯТОРЫ»). Строка дорожки в микшере:
 * слева кикер/имя/тейк, в середине волна с плейхедом и опциональной заметкой,
 * справа регулятор громкости и ряд FX-фишек. Мокап собирал регуляторы через
 * подмолекулы `VolumeSlider`/`FxChips` (ещё не портированы) — здесь они
 * развёрнуты напрямую в атомы `Slider`/`Chip`, как и требует реестр `k078`.
 */
const MixTrackRow = ({
  kicker,
  track,
  take,
  wave = 'active',
  children,
  playhead = 34,
  active = true,
  note,
  noteSide = 'left',
  volume = 80,
  onVolumeChange,
  fx = [],
  fxAddLabel = 'FX',
  onFxAdd,
  onClick,
}: MixTrackRowProps) => {
  const infoContent = (
    <>
      <Kicker text={kicker} size={9} />
      <MonoText text={track} size={10.5} />
      <div className={styles.take}>
        <AccentText text={take} tone="accent" size={9.5} />
      </div>
    </>
  );

  const noteClassName = [styles.note, noteSide === 'right' ? styles.noteRight : styles.noteLeft].join(' ');

  return (
    <Frame tone={active ? 'accent' : 'light'} selected={active} interactive={false} fill="paper" padding={0} block>
      <div className={styles.root}>
        {onClick ? (
          <button type="button" className={`${styles.info} ${styles.infoClickable}`} onClick={onClick}>
            {infoContent}
          </button>
        ) : (
          <div className={styles.info}>{infoContent}</div>
        )}

        <div className={styles.waveArea}>
          <div className={styles.waveInner}>
            {children ?? <Waveform variant={wave} />}
            {note && <span className={noteClassName}>{note}</span>}
            <Playhead position={playhead} height={44} tone="accent" withHandle={false} />
          </div>
        </div>

        <div className={styles.controls}>
          <Slider label="громкость" value={volume} onChange={onVolumeChange} size="mini" showLabel={false} />
          <div className={styles.fxRow}>
            {fx.map((label, index) => (
              <Chip key={`${index}-${label}`} label={label} kind="tinted" />
            ))}
            <Chip label={fxAddLabel} kind="add" onClick={onFxAdd} />
          </div>
        </div>
      </div>
    </Frame>
  );
};

export default MixTrackRow;
