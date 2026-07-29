import React from 'react';

import DisclosureArrow from '../atoms/DisclosureArrow';
import PriceTag from '../atoms/PriceTag';
import TextLabel from '../atoms/TextLabel';

import styles from './RunParams.module.css';

export type RunParamsDirection = 'column' | 'row';

export interface RunParamRow {
  /** Текст строки без цены и без стрелки раскрытия, напр. «ретраи: до 2 попыток/позиция». */
  text: string;
  /** Бюджет/стоимость в конце строки, напр. «≈$0.31». Пусто — цена не рисуется. */
  price?: string;
  /** Строка кликабельна и открывает раскрывающийся выбор — рисуется стрелка ▾. */
  expandable?: boolean;
}

export interface RunParamsProps {
  /** Пункты параметров запуска, сверху вниз (или слева направо в `direction="row"`). */
  rows: RunParamRow[];
  direction?: RunParamsDirection;
  /** Клик по раскрывающейся строке: индекс и текст строки (без цены и стрелки). */
  onPick?: (index: number, text: string) => void;
}

/**
 * Порт `design_ref/components/RunParams.dc.html` (molecules.json#k041,
 * «ПАРАМЕТРЫ ЗАПУСКА»).
 * Список параметров запуска (ретраи, пауза, бюджет): столбец или строка
 * коротких пунктов, часть из которых — раскрывающиеся выборы со стрелкой ▾
 * (кликабельна вся строка, как в исходном `renderVals`), часть — статичные
 * справки. У исходника нет пропа `context`: набранный текст стоит на
 * `--gu-muted`, который существует только в светлой чертёжной палитре, —
 * `onDark` поэтому не заведён. Цена набрана `PriceTag` с `fontFamily="body"` —
 * тем же случаем «смета внутри карточки», что у атома уже описан, — потому
 * что вся строка мокапа набрана одной гарнитурой, без переключения на моно.
 */
const RunParams = ({ rows, direction = 'column', onPick }: RunParamsProps) => {
  const rootClassName = [styles.root, direction === 'row' ? styles.row : styles.column].join(' ');

  return (
    <div className={rootClassName}>
      {rows.map((row, index) => {
        const interactive = Boolean(row.expandable && onPick);
        const itemClassName = [styles.item, interactive ? styles.clickable : ''].filter(Boolean).join(' ');

        const content = (
          <>
            <TextLabel text={row.text} tone="muted" size={10.5} />
            {row.price && (
              <span className={styles.price}>
                <PriceTag value={row.price} variant="standalone" fontFamily="body" sizePx={10.5} />
              </span>
            )}
            {row.expandable && (
              <span className={styles.arrow}>
                <DisclosureArrow expanded size={10.5} />
              </span>
            )}
          </>
        );

        if (!interactive) {
          return (
            <span key={`${index}-${row.text}`} className={itemClassName}>
              {content}
            </span>
          );
        }

        return (
          <button
            key={`${index}-${row.text}`}
            type="button"
            className={itemClassName}
            onClick={() => onPick?.(index, row.text)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
};

export default RunParams;
