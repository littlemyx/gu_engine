import React from 'react';

import Kicker from '../atoms/Kicker';

import styles from './TableHeader.module.css';

export type TableHeaderAlign = 'left' | 'right';

export interface TableHeaderColumn {
  /** Подпись колонки: «АРТЕФАКТ», «ЦЕНА», … */
  label: string;
  /** Ширина колонки, px. Не задано — колонка тянется (flex: 1). */
  width?: number;
  /** Выравнивание подписи. По умолчанию левое. */
  align?: TableHeaderAlign;
}

export interface TableHeaderProps {
  /** Колонки слева направо. */
  columns: TableHeaderColumn[];
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/TableHeader.dc.html` (molecules.json#k049).
 * Шапка таблицы-ведомости: строка узких капслочных подписей колонок, каждая —
 * либо тянущаяся, либо фиксированной ширины с выравниванием. У источника
 * `columns` — это мини-DSL-строка («ЛЕЙБЛ:80R»), здесь она развёрнута в
 * типизированный массив колонок; проп `width` из секции «Превью» дизайна не
 * переносится — заголовок всегда занимает всю ширину контейнера.
 */
const TableHeader = ({ columns, onDark = false }: TableHeaderProps) => {
  return (
    <div className={styles.root}>
      {columns.map((column, index) => {
        const align = column.align ?? 'left';
        const style: React.CSSProperties =
          column.width !== undefined
            ? { flex: '0 0 auto', width: `${column.width}px`, textAlign: align }
            : { flex: '1 1 0%', textAlign: align };

        return (
          <span key={`${column.label}-${index}`} className={styles.cell} style={style}>
            <Kicker text={column.label} onDark={onDark} />
          </span>
        );
      })}
    </div>
  );
};

export default TableHeader;
