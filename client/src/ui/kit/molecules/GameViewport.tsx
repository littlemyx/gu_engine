import React from 'react';

import Cursor from '../atoms/Cursor';
import HatchFill from '../atoms/HatchFill';
import Kicker from '../atoms/Kicker';
import TextLabel from '../atoms/TextLabel';

import styles from './GameViewport.module.css';

/** Взаимоисключающий оверлей поверх кадра: обычный показ, строгий режим (как релиз), тихая пересборка бандла. */
export type GameViewportOverlay = 'нет' | 'строгий' | 'пересборка';

export interface GameViewportProps {
  /** Подпись фона-заглушки, пока медиа не сгенерированы. */
  bg?: string;
  /** Показывать карточку персонажа справа внизу. Строгий режим её всё равно прячет. */
  showChar?: boolean;
  charName?: string;
  charNote?: string;
  /** Показывать диалоговое окно с репликой и выборами. Строгий режим его всё равно прячет. */
  showDialogue?: boolean;
  speaker?: string;
  line?: string;
  /** Строки вариантов выбора сверху вниз. */
  choices?: string[];
  /** Индекс подсвеченного варианта. */
  selected?: number;
  /** Зовётся с индексом варианта; без колбэка ряд выбора нерактивен. */
  onChoicePick?: (index: number) => void;
  overlay?: GameViewportOverlay;
  /** Строка бегущей строки пересборки — видна только при `overlay="пересборка"`. */
  banner?: string;
  overlayTitle?: string;
  overlayNote?: string;
  overlayAction?: string;
  width?: number;
  height?: number;
}

/**
 * Порт `design_ref/components/GameViewport.dc.html` (molecules.json#s003,
 * «ИГРОВОЙ ВЬЮПОРТ ПРЕВЬЮ»). Кадр игры внутри студии: фон-заглушка со
 * штриховкой, карточка персонажа, диалоговое окно с выборами и два
 * взаимоисключающих оверлея состояния — тихая пересборка бандла (бегущая
 * строка сверху) и строгий режим (полноэкранное затемнение с причиной и
 * следующим шагом). Персонаж и диалог гаснут вместе со строгим режимом,
 * как в исходной логике `renderVals()`.
 *
 * `MediaPlaceholder` и `DialogueBox` — dc-компоненты, на которые ссылается
 * макет, ещё не портированы как отдельные молекулы кита. Фон-заглушка
 * реализована через уже портированный атом `HatchFill` (совпадает по
 * рисунку: диагональная штриховка + пунктирная подпись-note), а окно
 * диалога с выборами собрано локально поверх атомов `Kicker`/`TextLabel` —
 * готового ряда выборов «обычный/выбран» с ховером в ките ещё нет.
 */
const GameViewport = ({
  bg = 'фон — заглушка · медиа не сгенерированы',
  showChar = true,
  charName = 'Кира · идл',
  charNote = 'из префаба v2 · ▣',
  showDialogue = true,
  speaker = 'Кира',
  line = 'Ты всё-таки пришёл. Я думала, шторм тебя напугал.',
  choices = ['Меня пугаешь только ты.', 'Я обещал.', '[молча смотреть]'],
  selected = 0,
  onChoicePick,
  overlay = 'нет',
  banner = 'тихая пересборка бандла ✓ · перезапуск · промотка по логу выборов',
  overlayTitle = 'Строгий режим: как релиз',
  overlayNote = 'бандл не собирается — 14 медиа-ассетов отсутствуют',
  overlayAction = 'Открыть зону «Медиа» · довести ≈$2.10',
  width = 880,
  height = 440,
}: GameViewportProps) => {
  const strict = overlay === 'строгий';
  const rebuilding = overlay === 'пересборка';
  const displayChar = showChar && !strict;
  const displayDialogue = showDialogue && !strict;

  return (
    <div className={styles.root} style={{ width: `${width}px`, height: `${height}px` }}>
      <div className={styles.background}>
        <HatchFill onDark note={bg} />
      </div>

      {displayChar && (
        <div className={styles.character}>
          <span className={styles.characterText}>
            {charName}
            <br />
            {charNote}
          </span>
        </div>
      )}

      {rebuilding && (
        <div className={styles.banner}>
          <span>{banner}</span>
          <Cursor tone="accent" onDark />
        </div>
      )}

      {displayDialogue && (
        <div className={styles.dialogue}>
          <Kicker text={speaker} tone="accent" onDark size={9.5} />
          <TextLabel text={`«${line}»`} onDark size={13.5} />
          <div className={styles.choices}>
            {choices.map((text, index) => {
              const isSelected = index === selected;
              const className = [styles.choice, isSelected ? styles.choiceSelected : ''].filter(Boolean).join(' ');

              if (!onChoicePick) {
                return (
                  <span key={`${index}-${text}`} className={className}>
                    {text}
                  </span>
                );
              }

              return (
                <button
                  key={`${index}-${text}`}
                  type="button"
                  className={className}
                  onClick={() => onChoicePick(index)}
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {strict && (
        <div className={styles.strictOverlay}>
          <span className={styles.strictTitle}>{overlayTitle}</span>
          <span className={styles.strictNote}>{overlayNote}</span>
          <span className={styles.strictAction}>{overlayAction}</span>
        </div>
      )}
    </div>
  );
};

export default GameViewport;
