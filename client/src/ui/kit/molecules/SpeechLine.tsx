import React from 'react';

import AccentText from '../atoms/AccentText';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './SpeechLine.module.css';

export interface SpeechLineProps {
  /** Имя говорящего персонажа. */
  name: string;
  /** Ремарка-эмоция рядом с именем; без неё скобки не рисуются. */
  emotion?: string;
  /** Текст реплики. */
  text: string;
  /** Ширина карточки в px; в макете диапазон 240–800, по умолчанию 400. */
  width?: number;
}

/**
 * Порт `design_ref/components/SpeechLine.dc.html` (molecules.json#p004).
 * Превью реплики персонажа в партитуре/сценарии: имя акцентным цветом,
 * необязательная эмоция приглушённым текстом в скобках и сама реплика — на
 * карточке-бумажке фиксированной ширины.
 */
const SpeechLine = ({ name, emotion, text, width = 400 }: SpeechLineProps) => {
  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <AccentText text={name} tone="accent" bold size={11.5} />
      {emotion && (
        <>
          {' '}
          <MutedText text={`(${emotion})`} size={10.5} />
        </>
      )}
      {': '}
      <TextLabel text={text} size={11.5} />
    </div>
  );
};

export default SpeechLine;
