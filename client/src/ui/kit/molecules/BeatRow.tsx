import React from 'react';

import DragHandle from '../atoms/DragHandle';
import Glyph from '../atoms/Glyph';
import IconButton from '../atoms/IconButton';
import SelectionHighlight from '../atoms/SelectionHighlight';
import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';

import styles from './BeatRow.module.css';

export type BeatRowBadge = 'none' | 'ready' | 'stale' | 'no-prose' | 'generating';
export type BeatRowActionKind = 'play' | 'retake' | 'more' | 'sheet';

export interface BeatRowProps {
  /** Подпись бита, например «Б5 Ссора». */
  title: string;
  selected?: boolean;
  /** Проза бита устарела относительно спайна/каста — открывает действие «в ведомость». */
  stale?: boolean;
  /** Показать действия и невыбранной строке (обычно раскрывается по ховеру списка). */
  actions?: boolean;
  /** Отметка свежести прозы в правом углу строки. */
  badge?: BeatRowBadge;
  /** Хэндл драг-н-дропа слева. */
  drag?: boolean;
  onSelect?: (selected: boolean) => void;
  onAction?: (kind: BeatRowActionKind) => void;
}

/** Алфавит StatusGlyph уже несёт нужные три состояния свежести плюс «идёт». */
const BADGE_STATUS: Record<Exclude<BeatRowBadge, 'none'>, StatusGlyphStatus> = {
  ready: 'fresh',
  stale: 'stale',
  'no-prose': 'none',
  generating: 'run',
};

/**
 * Порт `design_ref/components/BeatRow.dc.html` (molecules.json#k008,
 * «СТРОКА БИТА»).
 * Строка бита в партитуре/сценарии: хэндл, глиф бита, подпись, набор
 * быстрых действий и бейдж свежести прозы. У исходника нет пропа `context` —
 * все вложенные dc-import жёстко на «тёмном», строка всегда живёт на тёмном
 * хроме дока (тот же вывод, что и в `HierarchyRow`/`ArtifactRow`), поэтому
 * `onDark` здесь не нужен. Пропы `width`/`indent`/`backdrop` из мокапа лежат
 * в разделе «Превью» реестра — это обвязка редактора дизайна, а не
 * содержимое строки, поэтому не перенесены; левый отступ строки берёт
 * дефолт мокапа (20px) как константу. Заголовок собран локально, а не
 * атомом `TextLabel`: нужны два разных чернильных тона (выбрано — полный
 * `--gu-ink` жирным, обычно — `--gu-ink-85`), а у атома только один тон
 * `onDark` — то же решение, что и в `HierarchyRow`. Строка-контейнер — не
 * `<button>`, а `div[role="button"]`: внутри уже лежат настоящие кнопки
 * действий (`IconButton`), а `<button>` в `<button>` невалиден — так же
 * решил и сам исходник, взяв `role="button"` вместо тега кнопки.
 */
const BeatRow = ({
  title,
  selected = false,
  stale = false,
  actions = false,
  badge = 'none',
  drag = true,
  onSelect,
  onAction,
}: BeatRowProps) => {
  const showActions = selected || actions;
  const clickable = Boolean(onSelect);

  const toggle = () => onSelect?.(!selected);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  };

  // IconButton события не отдаёт, поэтому всплытие гасит обёртка: без этого
  // клик по «играть отсюда» заодно выделял бы всю строку.
  const runAction = (kind: BeatRowActionKind) => () => onAction?.(kind);

  const content = (
    <>
      {drag && <DragHandle size={9} onDark />}
      <Glyph glyph="◈" tone="info" size={10} onDark />
      <span className={[styles.title, selected ? styles.titleSelected : ''].filter(Boolean).join(' ')}>{title}</span>
      {showActions && (
        <span className={styles.actions} onClick={event => event.stopPropagation()}>
          <IconButton glyph="▶" hint="играть отсюда" onDark onClick={runAction('play')} />
          <IconButton glyph="⟳" hint="дубль с заметкой" onDark onClick={runAction('retake')} />
          <IconButton glyph="⋯" hint="ещё" onDark onClick={runAction('more')} />
          {stale && <IconButton glyph="◐" hint="в ведомость" tone="danger" onDark onClick={runAction('sheet')} />}
        </span>
      )}
      {badge !== 'none' && (
        <span className={styles.badgeSlot}>
          <StatusGlyph status={BADGE_STATUS[badge]} spin={badge === 'generating'} onDark size={9} />
        </span>
      )}
    </>
  );

  const rowClassName = [styles.row, clickable ? styles.clickable : '', clickable && !selected ? styles.hoverable : '']
    .filter(Boolean)
    .join(' ');

  const row = clickable ? (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={rowClassName}
      onClick={toggle}
      onKeyDown={handleKeyDown}
    >
      {content}
    </div>
  ) : (
    <div className={rowClassName}>{content}</div>
  );

  if (!selected) return row;

  return (
    <SelectionHighlight variant="row" onDark padding={0}>
      {row}
    </SelectionHighlight>
  );
};

export default BeatRow;
