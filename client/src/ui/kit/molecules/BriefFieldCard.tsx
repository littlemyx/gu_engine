import React from 'react';

import CheckGlyph from '../atoms/CheckGlyph';
import CornerMarks from '../atoms/CornerMarks';
import Cursor from '../atoms/Cursor';
import FillBadge from '../atoms/FillBadge';
import Kicker from '../atoms/Kicker';
import Stepper from '../atoms/Stepper';

import styles from './BriefFieldCard.module.css';

import type { KickerTone } from '../atoms/Kicker';

export type BriefFieldCardState = 'empty' | 'auto' | 'filling' | 'proposed' | 'done';
export type BriefFieldCardKind = 'text' | 'calendar';

export interface BriefFieldCardProps {
  /** Лейбл поля брифа: «ЛОГЛАЙН И ТОН», «КАСТ» и т. п. */
  kicker: string;
  state?: BriefFieldCardState;
  kind?: BriefFieldCardKind;
  /** Значение поля: текст брифа либо (для `state="auto"`) значение, решённое в прогоне. */
  value?: string;
  placeholder?: string;
  /** Директива из заметок автора, повлиявшая на генерацию поля. */
  directive?: string;
  hint?: string;
  /** Только для `kind="calendar"`. */
  days?: number;
  parts?: number;
  onDaysChange?: (value: number) => void;
  onPartsChange?: (value: number) => void;
  /** px, 220–560 в макете. */
  width?: number;
}

const STATE_LABEL: Record<BriefFieldCardState, string> = {
  empty: 'пусто',
  auto: 'авто',
  filling: 'заполняется',
  proposed: 'генератор · не смотрели',
  done: '✓',
};

const BORDER_CLASS: Record<BriefFieldCardState, string> = {
  empty: styles.borderEmpty,
  auto: styles.borderAuto,
  filling: styles.borderFilling,
  proposed: styles.borderProposed,
  done: styles.borderDone,
};

/**
 * Порт `design_ref/components/BriefFieldCard.dc.html` (molecules.json#s002,
 * «карточка поля брифа»).
 * Одно поле брифа в зоне «Замысел»: заголовок-кикер, значение (текст или
 * пара степперов для календаря), директива из заметок и подсказка —
 * состояние (пусто/авто/заполняется/предложено/готово) меняет и рамку,
 * и то, что показано вместо значения.
 */
const BriefFieldCard = ({
  kicker,
  state = 'done',
  kind = 'text',
  value = '',
  placeholder = 'заполните поле — чек-лист зоны отметит его ✓',
  directive = '',
  hint = '',
  days = 7,
  parts = 3,
  onDaysChange,
  onPartsChange,
  width = 320,
}: BriefFieldCardProps) => {
  const empty = state === 'empty';
  const auto = state === 'auto';
  const filling = state === 'filling';
  const proposed = state === 'proposed';
  const done = state === 'done';
  const isCalendar = kind === 'calendar' && !empty && !auto && !proposed;
  const isTextDone = done && !isCalendar;
  const isTextFilling = filling && !isCalendar;
  const hasValue = !!value;
  const hasDirective = !!directive;
  const hasHint = !!hint;

  const kickerTone: KickerTone = filling || proposed ? 'accent' : 'neutral';
  const cardClass = [styles.card, BORDER_CLASS[state]].filter(Boolean).join(' ');

  return (
    <CornerMarks tone="plain">
      <div className={cardClass} style={{ width: `${width}px` }}>
        <div className={styles.headRow}>
          <Kicker text={`${kicker} · ${STATE_LABEL[state]}`} tone={kickerTone} />
          {done && <CheckGlyph tone="ok" />}
          {proposed && <FillBadge label="⚙ предложено" uppercase={false} />}
        </div>

        {isTextDone && <p className={styles.valueText}>{value}</p>}

        {isTextFilling && (
          <div className={styles.fillingBox}>
            {value}
            <Cursor tone="accent" size={11} />
          </div>
        )}

        {empty && <p className={styles.placeholderText}>{placeholder}</p>}

        {auto && (
          <p className={styles.autoNote}>
            <span className={styles.autoLabel}>⚙ авто</span> — вы не задали, решит генератор
            {hasValue && (
              <>
                <br />
                <span className={styles.autoResolvedLabel}>решено в прогоне:</span>{' '}
                <span className={styles.autoResolvedValue}>{value}</span>
              </>
            )}
          </p>
        )}

        {proposed && <p className={styles.proposedBox}>{value}</p>}

        {hasDirective && <p className={styles.directiveNote}>→ из заметок: «{directive}»</p>}

        {isCalendar && (
          <div className={styles.calendarRow}>
            <Stepper value={days} min={1} max={30} label="дней" onChange={onDaysChange} />
            <Stepper value={parts} min={1} max={4} label="частей в дне" onChange={onPartsChange} />
            <span className={styles.calendarFormula}>
              = {days} × {parts} слотов
            </span>
          </div>
        )}

        {hasHint && <p className={styles.hintText}>{hint}</p>}
      </div>
    </CornerMarks>
  );
};

export default BriefFieldCard;
