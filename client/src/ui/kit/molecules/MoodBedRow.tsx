import React from 'react';

import IconButton from '../atoms/IconButton';
import Letterform from '../atoms/Letterform';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import StatusGlyph from '../atoms/StatusGlyph';
import TextLabel from '../atoms/TextLabel';

import styles from './MoodBedRow.module.css';

/**
 * `выбор` — идёт выбор дубля A/Б, показываются буквы и кнопка ▶.
 * Остальные состояния занимают место кнопок строкой пояснения: идёт
 * генерация, подложка в очереди, произвольное примечание или площадка без
 * привязанных локаций (использует тот же слот примечания).
 */
export type MoodBedRowState = 'choice' | 'generating' | 'queue' | 'note' | 'noLocations';

export interface MoodBedRowProps {
  /** Название настроения эмбиента, например «весёлая». */
  label: string;
  /** Технический код подложки, например «cheerful_warm». */
  code: string;
  state?: MoodBedRowState;
  /** Выбранный дубль в состоянии `choice`. */
  choice?: 'A' | 'B';
  /** Текст примечания для состояний `note` и `noLocations`. */
  note?: string;
  /** Ширина строки в px, 260–700. */
  width?: number;
  onDark?: boolean;
  /** Подсказка кнопки прослушивания (title/aria-label). */
  playHint?: string;
  onPick?: (letter: 'A' | 'B') => void;
  onPlay?: () => void;
}

const LETTERS: Array<'A' | 'B'> = ['A', 'B'];

/**
 * Порт `design_ref/components/MoodBedRow.dc.html` (molecules.json#p007,
 * «СТРОКА ЭМБИЕНТА»).
 * Строка подложки настроения в списке эмбиента: имя и код слева, справа —
 * либо выбор дубля A/Б с кнопкой прослушивания, либо служебное примечание
 * (генерируется, в очереди, произвольная заметка).
 */
const MoodBedRow = ({
  label,
  code,
  state = 'choice',
  choice = 'A',
  note = '= базовая подложка',
  width = 380,
  onDark = false,
  playHint = 'прослушать',
  onPick,
  onPlay,
}: MoodBedRowProps) => {
  const isChoice = state === 'choice';
  const muted = state === 'note' || state === 'noLocations';

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <TextLabel text={label} onDark={onDark} tone={muted ? 'muted' : 'normal'} size={11} />
      <span className={styles.code}>
        <MonoText text={code} onDark={onDark} muted={muted} size={9.5} />
      </span>
      {isChoice ? (
        <span className={styles.choiceGroup}>
          <span className={styles.letters}>
            {LETTERS.map(letter => (
              <Letterform
                key={letter}
                letter={letter}
                variant={choice === letter ? 'filled' : 'outline'}
                size={20}
                onDark={onDark}
                onClick={onPick ? () => onPick(letter) : undefined}
              />
            ))}
          </span>
          <IconButton glyph="▶" hint={playHint} size="toolbar" onDark={onDark} onClick={onPlay} />
        </span>
      ) : (
        <span className={styles.note}>
          {state === 'generating' ? (
            <>
              <StatusGlyph status="run" size={10} onDark={onDark} />
              <TextLabel text="генерируется…" onDark={onDark} tone="accent" size={10} />
            </>
          ) : state === 'queue' ? (
            <MutedText text="в очереди" onDark={onDark} size={10} />
          ) : (
            <MutedText text={note} onDark={onDark} quiet size={10} />
          )}
        </span>
      )}
    </div>
  );
};

export default MoodBedRow;
