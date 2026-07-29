import React from 'react';

import Frame from '../atoms/Frame';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import TokenHighlight from '../atoms/TokenHighlight';

import styles from './PromptTemplate.module.css';

export interface PromptTemplateProps {
  /** Текст шаблона промпта; фрагменты вида `{scene_focus}` подсвечиваются как токены. */
  text: string;
  /** Пояснение под блоком — чем конвейер подставит токен. Пусто — блок не рендерится. */
  note?: string;
  onDark?: boolean;
  /** Ширина блока, px. */
  width?: number;
}

const TOKEN_SPLIT_RE = /(\{[^}]*\})/;
const TOKEN_TEST_RE = /^\{[^}]*\}$/;

/**
 * Порт `design_ref/components/PromptTemplate.dc.html` (molecules.json#p049).
 * Моноширинный блок текста промпта с подсветкой токенов вида `{scene_focus}` —
 * автор брифа видит, где конвейер подставит значение сам, и необязательную
 * подсказку под блоком, откуда токен возьмётся.
 */
const PromptTemplate = ({ text, note = '', onDark = false, width = 360 }: PromptTemplateProps) => {
  const parts = text.split(TOKEN_SPLIT_RE).filter(part => part !== '');
  const hasNote = note !== '';
  const boxWrapClass = [styles.boxWrap, onDark ? styles.boxWrapDark : styles.boxWrapLight].join(' ');

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <div className={boxWrapClass}>
        <Frame tone={onDark ? 'dark' : 'light'} interactive={false} block paddingX={8} paddingY={6}>
          <div className={styles.parts}>
            {parts.map((part, index) =>
              TOKEN_TEST_RE.test(part) ? (
                <TokenHighlight key={index} token={part.slice(1, -1)} inSentence={false} onDark={onDark} />
              ) : (
                <MonoText key={index} text={part} onDark={onDark} size={10.5} />
              ),
            )}
          </div>
        </Frame>
      </div>
      {hasNote ? (
        <div className={styles.note}>
          <MutedText text={note} onDark={onDark} size={10} />
        </div>
      ) : null}
    </div>
  );
};

export default PromptTemplate;
