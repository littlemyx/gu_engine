import React from 'react';

import CornerMarks from '../atoms/CornerMarks';
import Cursor from '../atoms/Cursor';

import styles from './HighlightLine.module.css';

export type HighlightLineKind = 'quote' | 'editor';

export interface HighlightLineProps {
  kind?: HighlightLineKind;
  /** Строка над репликой — только у `kind="editor"` (например, ремарка или номер дубля). */
  pre?: string;
  before?: string;
  /** Подсвеченный фрагмент реплики. */
  highlight: string;
  after?: string;
  /** Строка под репликой — источник цитаты или служебная пометка. */
  post?: string;
  /** Мигающий курсор после реплики — «печатается прямо сейчас»; только у `kind="editor"`. */
  cursor?: boolean;
  /** Ширина в px; без неё блок растягивается на всю ширину контейнера. */
  width?: number;
}

/**
 * Порт `design_ref/components/HighlightLine.dc.html` (molecules.json#s007,
 * «строка с подсветкой»).
 * Реплика с подсвеченным фрагментом — цитата сценария на чертёжной рамке
 * (`kind="quote"`) либо строка живого стрима генерации на тёмном хроме,
 * моноширинная и с мигающим курсором (`kind="editor"`).
 */
const HighlightLine = ({
  kind = 'quote',
  pre = '',
  before = 'КИРА: «',
  highlight,
  after = ' вернуться до шторма…»',
  post = '',
  cursor = false,
  width,
}: HighlightLineProps) => {
  const isEditor = kind === 'editor';
  const hasPre = isEditor && !!pre;
  const hasPost = !!post;
  const boxClass = isEditor ? styles.editorBox : styles.quoteBox;
  const boxStyle = width !== undefined ? { width: `${width}px` } : undefined;
  const highlightClass = isEditor ? styles.editorHighlight : styles.quoteHighlight;
  const postClass = isEditor ? styles.postDark : styles.post;

  const box = (
    <div className={boxClass} style={boxStyle}>
      {hasPre && <div className={styles.pre}>{pre}</div>}
      <div className={styles.line}>
        {before}
        <b className={highlightClass}>{highlight}</b>
        {after}
        {isEditor && cursor && <Cursor tone="accent" onDark size={11} />}
      </div>
      {hasPost && <div className={postClass}>{post}</div>}
    </div>
  );

  if (isEditor) return box;

  return <CornerMarks tone="plain">{box}</CornerMarks>;
};

export default HighlightLine;
