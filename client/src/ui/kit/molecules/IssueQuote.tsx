import React from 'react';

import Frame from '../atoms/Frame';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './IssueQuote.module.css';

export interface IssueQuoteProps {
  /** Реплика или фраза из брифа, вокруг которой строится «зона напряжения». */
  quote: string;
  /** Подпись перед цитатой. */
  quoteLabel?: string;
  /** Сноска-бриф под цитатой (например, к какому месту брифа она привязана); пустая строка её скрывает. */
  note?: string;
  /** Ширина карточки в px. */
  width?: number;
}

/**
 * Порт `design_ref/components/IssueQuote.dc.html` (molecules.json#k089,
 * «ЦИТАТА ПРОБЛЕМЫ»). Карточка-цитата на кастинг-столе замысла: реплика из
 * брифа в кавычках и необязательная сноска под ней, всегда на тёмном хроме.
 * `Frame` (tone="dark") даёт волосяную рамку и не отвечает за фон-подложку
 * ~4% — макет требует лёгкую заливку, которой у атома нет, поэтому она
 * добавлена локальным оборачивающим блоком (см. `missingAtoms` в отчёте).
 */
const IssueQuote = ({ quote, quoteLabel = 'цитата:', note = '', width = 340 }: IssueQuoteProps) => {
  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <Frame tone="dark" block paddingX={10} paddingY={8} interactive={false}>
        <TextLabel text={`${quoteLabel} «${quote}»`} onDark size={10.5} />
        {note !== '' && (
          <>
            <br />
            <MutedText text={note} onDark quiet size={10.5} />
          </>
        )}
      </Frame>
    </div>
  );
};

export default IssueQuote;
