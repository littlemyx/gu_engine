import React from 'react';

import Counter, { type CounterTone } from '../atoms/Counter';
import DisclosureArrow from '../atoms/DisclosureArrow';
import TextLabel from '../atoms/TextLabel';

import styles from './ActRow.module.css';

export type ActRowNoteTone = Extract<CounterTone, 'error' | 'warn' | 'neutral'>;

export interface ActRowProps {
  /** Подпись акта: «Акт II · Сближение · д4–5». */
  title: string;
  /** Заметка справа — напр. «1 устарел». Пусто — заметка не рисуется. */
  note?: string;
  noteTone?: ActRowNoteTone;
  expanded?: boolean;
  /** Без колбэка строка немая — рендерится как div, а не кнопка. */
  onToggle?: (expanded: boolean) => void;
}

/**
 * Порт `design_ref/components/ActRow.dc.html` (molecules.json#k007,
 * «СТРОКА АКТА (ДЕРЕВО)»).
 * Заголовок акта в дереве партитуры: стрелка раскрытия, подпись акта и
 * необязательная заметка (устаревшие сцены, предупреждения) справа — тон
 * заметки переиспользует палитру атома `Counter`. У исходника нет пропа
 * `context` — строка всегда живёт на тёмном хроме дерева партитуры (как и
 * `HierarchyRow`), поэтому `onDark` дочерним атомам задан жёстко, а не
 * пропом. Вся строка кликабельна и переключает раскрытие, поэтому стрелка
 * рисуется немой (`DisclosureArrow` без `onToggle`), а клик и
 * `aria-expanded` держит строка целиком.
 */
const ActRow = ({ title, note = '', noteTone = 'error', expanded = true, onToggle }: ActRowProps) => {
  const interactive = Boolean(onToggle);
  const className = [styles.root, interactive ? styles.clickable : ''].filter(Boolean).join(' ');

  const content = (
    <>
      <DisclosureArrow expanded={expanded} onDark size={9} />
      <span className={styles.title}>
        <TextLabel text={title} onDark bold size={11} />
      </span>
      {note && (
        <span className={styles.note}>
          <Counter value={note} tone={noteTone} onDark size={9} />
        </span>
      )}
    </>
  );

  if (!interactive) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" className={className} aria-expanded={expanded} onClick={() => onToggle?.(!expanded)}>
      {content}
    </button>
  );
};

export default ActRow;
