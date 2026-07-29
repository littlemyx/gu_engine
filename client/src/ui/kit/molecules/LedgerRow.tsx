import React from 'react';

import Counter from '../atoms/Counter';
import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import PriceTag from '../atoms/PriceTag';
import StatusGlyph from '../atoms/StatusGlyph';

import styles from './LedgerRow.module.css';

export type LedgerRowState = 'готово' | 'пишется' | 'очередь';

export interface LedgerRowProps {
  /** Идентификатор артефакта: путь сцены, юнита, ассета. Проп `name` в макете
   * переименован — там это зарезервированный атрибут инструмента дизайна. */
  artifact: string;
  /** Откуда взята строка: «предложено», «—». Дефолт зависит от `state`. */
  source?: string;
  /** Какой вариант выбран: «№1», «черновик», «—». Дефолт зависит от `state`. */
  take?: string;
  /** Смета: «$0.014», «…», «—». Дефолт зависит от `state`. */
  price?: string;
  /** Переопределяет подпись статуса поверх дефолтной для `state`. */
  status?: string;
  state?: LedgerRowState;
  /** Ширины колонок source/state/take/price, px. */
  colWidths?: [number, number, number, number];
  /** Строка — часть примыкающей группы: без нижней рамки, имя чуть жирнее. */
  expanded?: boolean;
  onClick?: () => void;
}

const DEFAULT_COL_WIDTHS: [number, number, number, number] = [100, 92, 64, 56];

const DEFAULT_SOURCE: Record<LedgerRowState, string> = {
  готово: 'предложено',
  пишется: '—',
  очередь: '—',
};

const DEFAULT_TAKE: Record<LedgerRowState, string> = {
  готово: '№1',
  пишется: 'черновик',
  очередь: '—',
};

const DEFAULT_PRICE: Record<LedgerRowState, string> = {
  готово: '$0.014',
  пишется: '…',
  очередь: '—',
};

const DEFAULT_STATUS: Record<LedgerRowState, string> = {
  готово: 'готово',
  пишется: 'пишется',
  очередь: 'в очереди',
};

const STATE_CLASS: Record<LedgerRowState, string> = {
  готово: styles.ready,
  пишется: styles.active,
  очередь: styles.queued,
};

/**
 * Порт `design_ref/components/LedgerRow.dc.html` (molecules.json#k051, #k071).
 * Строка ведомости сцен/юнитов/префабов конвейера: готовый вариант с ценой,
 * пишущийся черновик со спиннером или строка в очереди — три ступени, через
 * которые проходит каждый артефакт до фиксации в ведомости.
 */
const LedgerRow = ({
  artifact,
  source,
  take,
  price,
  status,
  state = 'готово',
  colWidths = DEFAULT_COL_WIDTHS,
  expanded = false,
  onClick,
}: LedgerRowProps) => {
  const clickable = !!onClick;
  const [wSource, wState, wTake, wPrice] = colWidths;
  const statusText = status ?? DEFAULT_STATUS[state];

  const className = [
    styles.root,
    STATE_CLASS[state],
    expanded ? styles.expanded : '',
    clickable ? styles.clickable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={styles.name}>
        <MonoText text={artifact} muted={state === 'очередь'} />
      </span>
      <span className={styles.col} style={{ width: `${wSource}px` }}>
        <MutedText text={source ?? DEFAULT_SOURCE[state]} quiet={state === 'очередь'} />
      </span>
      <span className={styles.col} style={{ width: `${wState}px` }}>
        {state !== 'очередь' && (
          <StatusGlyph status={state === 'пишется' ? 'run' : 'fresh'} spin={state === 'пишется'} size={10} />
        )}
        {state === 'очередь' ? (
          <MutedText text={statusText} quiet />
        ) : (
          <span className={styles.statusLabel}>{statusText}</span>
        )}
      </span>
      <span className={styles.col} style={{ width: `${wTake}px` }}>
        <Counter value={take ?? DEFAULT_TAKE[state]} tone={state === 'пишется' ? 'accent' : 'neutral'} />
      </span>
      <span className={styles.price} style={{ width: `${wPrice}px` }}>
        <PriceTag value={price ?? DEFAULT_PRICE[state]} variant="standalone" />
      </span>
    </>
  );

  if (clickable) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

export default LedgerRow;
