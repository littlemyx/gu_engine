import React from 'react';

import CheckGlyph from '../atoms/CheckGlyph';
import Glyph from '../atoms/Glyph';
import IndentSpacer from '../atoms/IndentSpacer';
import MutedText from '../atoms/MutedText';
import PriceTag from '../atoms/PriceTag';
import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';
import TextLabel from '../atoms/TextLabel';

import styles from './EstimateRow.module.css';

export type EstimateRowKind = 'position' | 'cascade' | 'group' | 'locked';
export type EstimateRowFrame = 'around' | 'bottom' | 'none';

export interface EstimateRowProps {
  /** Текст строки — без ведущего/замыкающего глифа, тот рисуется отдельным атомом. */
  text: string;
  /** Смета позиции, например «≈$0.02». Без цены — не передавать (обычно у kind="group"). */
  price?: string;
  kind?: EstimateRowKind;
  /** Обвод строки: со всех сторон, только снизу (разделитель списка) или без обвода. */
  frame?: EstimateRowFrame;
  /** Свежесть позиции — осмыслена у kind="position". */
  status?: StatusGlyphStatus;
  /** Ступень отступа перед текстом — осмыслена у kind="cascade". */
  indentLevel?: number;
  onClick?: () => void;
}

const KIND_CLASS: Record<EstimateRowKind, string> = {
  position: styles.kindPosition,
  cascade: styles.kindCascade,
  group: styles.kindGroup,
  locked: styles.kindLocked,
};

const FRAME_CLASS: Record<EstimateRowFrame, string> = {
  around: styles.frameAround,
  bottom: styles.frameBottom,
  none: styles.frameNone,
};

/** Кегль строки на кегль макета: 10.5px у позиции/залоченного, 10px у каскада/группы. */
const KIND_FONT_SIZE: Record<EstimateRowKind, number> = {
  position: 10.5,
  cascade: 10,
  group: 10,
  locked: 10.5,
};

/**
 * Порт `design_ref/components/EstimateRow.dc.html` (molecules.json#k036–k039:
 * «СТРОКА ПОЗИЦИИ СМЕТЫ» / «ВЛОЖЕННАЯ СТРОКА КАСКАДА» / «СВЁРНУТАЯ ГРУППА
 * ПОЗИЦИЙ» / «СТРОКА „ЗАЛОЧЕНО — ПРОПУСКАЕМ“» — один исходник, четыре
 * зарегистрированные молекулы, переключаемые пропом `kind`).
 * Строка ведомости сметы: `position` — позиция верхнего уровня с индикатором
 * свежести и жирной ценой, `cascade` — вложенный потомок с отступом и
 * приглушённым текстом, `group` — свёрнутая группа без цены со стрелкой
 * раскрытия, `locked` — залоченная группа с галочкой и ценой «$0». У атома
 * `Frame` нет ни бордюра «только снизу», ни асимметричного паддинга, которые
 * нужны этой строке (проп `frame` — реальный вариант вида из раздела «Вид»
 * реестра, а не обвязка превью) — обвод и фон реализованы локально в
 * module.css теми же токенами линии/бумаги (`--gu-line-soft`,
 * `--gu-line-faint`, `--gu-paper`), какими пользуется сам атом.
 */
const EstimateRow = ({
  text,
  price,
  kind = 'position',
  frame = 'around',
  status = 'stale',
  indentLevel = 1,
  onClick,
}: EstimateRowProps) => {
  const clickable = Boolean(onClick);
  const fontSize = KIND_FONT_SIZE[kind];

  const className = [styles.root, KIND_CLASS[kind], FRAME_CLASS[frame], clickable ? styles.clickable : '']
    .filter(Boolean)
    .join(' ');

  let leading: React.ReactNode = null;
  if (kind === 'position') {
    leading = <StatusGlyph status={status} size={fontSize} spin={false} />;
  } else if (kind === 'cascade') {
    leading = <IndentSpacer level={indentLevel} step={14} />;
  } else if (kind === 'locked') {
    leading = <CheckGlyph tone="muted" size={fontSize} />;
  }

  const label =
    kind === 'position' ? <TextLabel text={text} size={fontSize} /> : <MutedText text={text} size={fontSize} />;

  let trailing: React.ReactNode = null;
  if (kind === 'group') {
    trailing = <Glyph glyph="▸" tone="muted" size={fontSize} />;
  } else if (price) {
    trailing = <PriceTag value={price} variant={kind === 'position' ? 'total' : 'standalone'} sizePx={fontSize} />;
  }

  const content = (
    <>
      {leading}
      <span className={styles.label}>{label}</span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </>
  );

  if (!clickable) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
};

export default EstimateRow;
