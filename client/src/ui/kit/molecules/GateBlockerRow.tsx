import React from 'react';

import PriceTag from '../atoms/PriceTag';
import StatusGlyph, { type StatusGlyphStatus } from '../atoms/StatusGlyph';
import TextLabel, { type TextLabelTone } from '../atoms/TextLabel';

import styles from './GateBlockerRow.module.css';

export type GateBlockerRowState = 'активный' | 'решён';

export interface GateBlockerRowProps {
  /** Что именно блокирует гейт, напр. «QA-отчёт #7 устарел — прогнан до правки Б5 · гейту нужен свежий». */
  text: string;
  /** Подпись действия справа, напр. «перегнать ≈$0.40» или «готово ✓». Дефолт зависит от `state`. Пустая строка убирает действие целиком. */
  action?: string;
  state?: GateBlockerRowState;
  /** Без колбэка действие неинтерактивно, даже когда `state="активный"`. У решённого блокера действие никогда не кликабельно. */
  onAction?: () => void;
}

const GLYPH_STATUS: Record<GateBlockerRowState, StatusGlyphStatus> = {
  активный: 'stale',
  решён: 'ok',
};

const TEXT_TONE: Record<GateBlockerRowState, TextLabelTone> = {
  активный: 'normal',
  решён: 'muted',
};

const DEFAULT_ACTION: Record<GateBlockerRowState, string> = {
  активный: 'перегнать ≈$0.40',
  решён: 'готово ✓',
};

const STATE_CLASS: Record<GateBlockerRowState, string> = {
  активный: styles.active,
  решён: styles.resolved,
};

/**
 * Порт `design_ref/components/GateBlockerRow.dc.html` (molecules.json#k097,
 * «СТРОКА БЛОКЕРА ГЕЙТА»).
 * Строка причины, по которой гейт не пропускает: приглушённый глиф свежести,
 * описание и действие справа — либо платный перегон, либо отметка «готово».
 * `Frame` не подошёл: ни один его тон не даёт ровно `--gu-line-soft` для рамки
 * решённого блокера (только `--color-neutral-400`, заметно светлее), поэтому
 * рамка и фон набраны локально теми же токенами (`--gu-blueprint-700`,
 * `--gu-line-soft`, `--gu-paper`), какими пользуется сам атом — см.
 * `missingAtoms` отчёта задачи. Ни у `TextLabel`, ни у `PriceTag` нет тона
 * `--gu-blueprint-700` для действия активного блокера — цвет действия задан
 * оболочкой через `currentColor`, который подхватывает вариант `button` у
 * `PriceTag`.
 */
const GateBlockerRow = ({ text, action, state = 'активный', onAction }: GateBlockerRowProps) => {
  const resolved = state === 'решён';
  const actionText = action ?? DEFAULT_ACTION[state];
  const hasAction = actionText !== '';
  const clickable = hasAction && Boolean(onAction) && !resolved;

  const rootClassName = [styles.root, STATE_CLASS[state]].filter(Boolean).join(' ');
  const actionClassName = [
    styles.action,
    resolved ? styles.actionResolved : styles.actionActive,
    clickable ? styles.actionClickable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const actionContent = <PriceTag value={actionText} variant="button" fontFamily="body" />;

  return (
    <div className={rootClassName}>
      <span className={styles.glyph}>
        <StatusGlyph status={GLYPH_STATUS[state]} size={11} spin={false} />
      </span>
      <span className={styles.text}>
        <TextLabel text={text} tone={TEXT_TONE[state]} size={11} />
      </span>
      {hasAction &&
        (clickable ? (
          <button type="button" className={actionClassName} onClick={onAction}>
            {actionContent}
          </button>
        ) : (
          <span className={actionClassName}>{actionContent}</span>
        ))}
    </div>
  );
};

export default GateBlockerRow;
