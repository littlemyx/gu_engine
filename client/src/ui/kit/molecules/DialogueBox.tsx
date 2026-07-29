import React from 'react';

import Frame from '../atoms/Frame';
import Kicker from '../atoms/Kicker';
import OutlineButton from '../atoms/OutlineButton';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './DialogueBox.module.css';

export interface DialogueChoice {
  id: string;
  text: string;
}

export interface DialogueBoxProps {
  /** Имя говорящего персонажа — надзаголовок над репликой. */
  speaker: string;
  /** Текст реплики; обрамляется кавычками-ёлочками, как в макете. */
  line: string;
  /** Варианты ответа игрока. */
  choices: DialogueChoice[];
  /** Индекс выбранного варианта; `null`/не задан — ничего не выбрано. */
  selectedIndex?: number | null;
  /** Без колбэка варианты нерактивны (не рендерятся кнопками). */
  onPick?: (index: number) => void;
}

/**
 * Порт `design_ref/components/DialogueBox.dc.html` (molecules.json#k063,
 * «ДИАЛОГОВОЕ ОКНО С ВЫБОРАМИ»).
 * Оверлей диалога игрока: имя и реплика персонажа поверх тёмной панели, ниже —
 * стопка вариантов ответа. Выбор — управляемый пропс `selectedIndex`, подсветка
 * выбранного варианта — тонированная подложка под нейтральной кнопкой, а не
 * отдельный акцентный тон кнопки.
 */
const DialogueBox = ({ speaker, line, choices, selectedIndex = null, onPick }: DialogueBoxProps) => {
  return (
    <Frame tone="blueprint-700" interactive={false} padding={0}>
      <div className={styles.body}>
        <Kicker text={speaker} tone="accent" onDark />
        <TextLabel text={`«${line}»`} onDark size={13.5} />
        <div className={styles.choices}>
          {choices.map((choice, index) => {
            const button = (
              <OutlineButton
                label={choice.text}
                tone="neutral"
                size="compact"
                onDark
                onClick={onPick ? () => onPick(index) : undefined}
              />
            );

            if (index === selectedIndex) {
              return (
                <ToneSurface key={choice.id} tone="run" padding={0}>
                  {button}
                </ToneSurface>
              );
            }

            return <React.Fragment key={choice.id}>{button}</React.Fragment>;
          })}
        </div>
      </div>
    </Frame>
  );
};

export default DialogueBox;
