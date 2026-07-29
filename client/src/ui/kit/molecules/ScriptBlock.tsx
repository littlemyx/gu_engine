import React from 'react';

import AccentText from '../atoms/AccentText';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import SelectionHighlight from '../atoms/SelectionHighlight';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './ScriptBlock.module.css';

/** Тон правой колонки служебных заметок: тише обычного или акцентный. */
export type ScriptAnnotationTone = 'muted' | 'accent';

export interface ScriptTransitionRow {
  kind: 'transition';
  id: string;
  /** Надпись перехода: «Утро следующего дня» и т.п. */
  text: string;
}

export interface ScriptProseRow {
  kind: 'prose';
  id: string;
  text: string;
  /** Прощальная реплика в конце сцены: пунктирная верхняя граница, тише цвет. */
  farewell?: boolean;
  annotation?: string[];
  annotationTone?: ScriptAnnotationTone;
}

export interface ScriptSpeechRow {
  kind: 'speech';
  id: string;
  name: string;
  /** Ремарка-эмоция; без неё скобки не рисуются. */
  emotion?: string;
  text: string;
  annotation?: string[];
  annotationTone?: ScriptAnnotationTone;
}

export interface ScriptChoiceRow {
  kind: 'choice';
  id: string;
  /** Жирный «лид» перед текстом выбора: «Выбран тёплый:». */
  lead: string;
  text: string;
  hint?: string;
  annotation?: string[];
  annotationTone?: ScriptAnnotationTone;
}

export type ScriptRow = ScriptTransitionRow | ScriptProseRow | ScriptSpeechRow | ScriptChoiceRow;

export interface ScriptBlockProps {
  /** Надзаголовок сцены: место и время. */
  heading: string;
  rows: ScriptRow[];
  /** Ширина колонки аннотаций, px. В макете диапазон 120–260, по умолчанию 180. */
  annotationWidth?: number;
  /** Ширина всего блока, px. Не задано — растягивается на всю доступную ширину. */
  width?: number;
}

const Annotation = ({ lines, tone = 'muted' }: { lines: string[]; tone?: ScriptAnnotationTone }) => (
  <div className={styles.annotation}>
    {lines.map((line, index) =>
      tone === 'accent' ? (
        <div key={index} className={styles.annotationAccent}>
          {line}
        </div>
      ) : (
        <MonoText key={index} text={line} size={10} muted />
      ),
    )}
  </div>
);

const annotationCell = (row: ScriptProseRow | ScriptSpeechRow | ScriptChoiceRow) =>
  row.annotation && row.annotation.length > 0 ? (
    <Annotation lines={row.annotation} tone={row.annotationTone} />
  ) : (
    <div />
  );

/**
 * Порт `design_ref/components/ScriptBlock.dc.html` (molecules.json#p030,
 * «СЦЕНА СЦЕНАРИЯ (проза+реплики+аннотации)»).
 * Читаемый сценарий сцены: переходы-разделители, курсивная проза, реплики
 * персонажей и развилки выбора — каждая строка с необязательной колонкой
 * служебных заметок (провенанс, эффекты, флаги) справа.
 */
const ScriptBlock = ({ heading, rows, annotationWidth = 180, width }: ScriptBlockProps) => {
  const style = {
    ...(width ? { width: `${width}px` } : {}),
    '--script-ann-width': `${annotationWidth}px`,
  } as React.CSSProperties;

  return (
    <div className={styles.root} style={style}>
      <div className={styles.heading}>{heading}</div>
      <div className={styles.grid}>
        {rows.map(row => {
          if (row.kind === 'transition') {
            return (
              <div key={row.id} className={styles.transitionRow}>
                {row.text}
              </div>
            );
          }

          if (row.kind === 'prose') {
            return (
              <React.Fragment key={row.id}>
                <div className={[styles.prose, row.farewell ? styles.farewell : ''].filter(Boolean).join(' ')}>
                  <TextLabel text={row.text} size={12.5} tone={row.farewell ? 'muted' : 'normal'} />
                </div>
                {annotationCell(row)}
              </React.Fragment>
            );
          }

          if (row.kind === 'speech') {
            return (
              <React.Fragment key={row.id}>
                <div className={styles.speech}>
                  <AccentText text={row.name} tone="accent" bold size={11.5} />{' '}
                  {row.emotion ? <MutedText text={`(${row.emotion})`} quiet size={10.5} /> : null}
                  {': '}
                  <TextLabel text={`«${row.text}»`} size={12.5} />
                </div>
                {annotationCell(row)}
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={row.id}>
              <div className={styles.choiceOuter}>
                <SelectionHighlight variant="ring" outlineTone="accent-900" padding={0} outlineOffset={0}>
                  <ToneSurface tone="accent" padding={0}>
                    <div className={styles.choiceInner}>
                      <TextLabel text={row.lead} bold size={12.5} /> <TextLabel text={row.text} size={12.5} />{' '}
                      {row.hint ? <MutedText text={row.hint} quiet size={11} /> : null}
                    </div>
                  </ToneSurface>
                </SelectionHighlight>
              </div>
              {annotationCell(row)}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ScriptBlock;
