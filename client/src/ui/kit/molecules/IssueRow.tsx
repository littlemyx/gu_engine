import React from 'react';

import TextLabel from '../atoms/TextLabel';

import styles from './IssueRow.module.css';

export type IssueRowKind = 'blocker' | 'warning';

export interface IssueRowProps {
  /** Что не так и на чём споткнулись, напр. «2 юнита без прозы — держат гейт». */
  text: string;
  /** Подпись бейджа слева. По умолчанию берётся из `kind` («БЛОКЕР» / «ПРЕДУПР»). */
  badge?: string;
  /** Действие со сметой справа, напр. «→ Проза · ≈$0.16». Без него столбец действия не рисуется. */
  action?: string;
  kind?: IssueRowKind;
  selected?: boolean;
  onClick?: () => void;
}

const KIND_CLASS: Record<IssueRowKind, string> = {
  blocker: styles.blocker,
  warning: styles.warning,
};

const KIND_BADGE_CLASS: Record<IssueRowKind, string> = {
  blocker: styles.badgeBlocker,
  warning: styles.badgeWarning,
};

const KIND_BADGE_LABEL: Record<IssueRowKind, string> = {
  blocker: 'БЛОКЕР',
  warning: 'ПРЕДУПР',
};

/**
 * Порт `design_ref/components/IssueRow.dc.html` (molecules.json#k090,
 * «СТРОКА ПРОБЛЕМЫ · БЛОКЕР / ПРЕДУПРЕЖДЕНИЕ»).
 * Строка списка проблем гейта: бейдж серьёзности, текст проблемы и опциональное
 * действие со сметой справа. `blocker` держит гейт и красится плотной заливкой
 * blueprint, `warning` — контурный и гейт не держит.
 * Ни `FillBadge` (заливка жёстко на `--color-accent`), ни `Badge` (тона
 * neutral/accent/error не дают `--gu-blueprint-700`), ни `AccentText`/`PriceTag`
 * (тот же пробел — нет blueprint-тона) не попадают в чертёжную рамп-семью этой
 * строки, а собственного `className` у атомов нет, поэтому подменить их цвет
 * снаружи нельзя. Бейдж, рамка и действие собраны локально теми же токенами
 * (`--gu-blueprint-700`, `--gu-blueprint-line`), какими уже пользуется `Frame`
 * и соседняя `DecisionRow`.
 */
const IssueRow = ({ text, badge, action, kind = 'blocker', selected = false, onClick }: IssueRowProps) => {
  const clickable = Boolean(onClick);

  const className = [styles.root, KIND_CLASS[kind], selected ? styles.selected : '', clickable ? styles.clickable : '']
    .filter(Boolean)
    .join(' ');

  const badgeLabel = badge ?? KIND_BADGE_LABEL[kind];

  const content = (
    <>
      <span className={`${styles.badge} ${KIND_BADGE_CLASS[kind]}`}>{badgeLabel}</span>
      <span className={styles.text}>
        <TextLabel text={text} size={10.5} bold={selected} />
      </span>
      {action && <span className={styles.action}>{action}</span>}
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

export default IssueRow;
