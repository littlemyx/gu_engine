import React from 'react';

import TableHeader, { type TableHeaderColumn } from './TableHeader';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TableHeader';

const LEDGER_COLUMNS: TableHeaderColumn[] = [
  { label: 'АРТЕФАКТ' },
  { label: 'ВЛАДЕНИЕ', width: 80 },
  { label: 'СВЕЖЕСТЬ', width: 70 },
  { label: 'ТЕЙК', width: 44 },
  { label: 'ЦЕНА', width: 44, align: 'right' },
];

const NARROW_COLUMNS: TableHeaderColumn[] = [{ label: 'ИМЯ' }, { label: 'СТАТУС', width: 60, align: 'right' }];

export const cases: GalleryCase[] = [
  {
    title: 'ведомость артефактов',
    node: <TableHeader columns={LEDGER_COLUMNS} />,
  },
  {
    title: 'узкая шапка, две колонки',
    node: <TableHeader columns={NARROW_COLUMNS} />,
  },
  {
    title: 'на тёмном хроме',
    node: <TableHeader columns={LEDGER_COLUMNS} onDark />,
    dark: true,
  },
];
