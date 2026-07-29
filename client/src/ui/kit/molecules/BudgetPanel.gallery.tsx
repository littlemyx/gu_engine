import React from 'react';

import BudgetPanel from './BudgetPanel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BudgetPanel';

const ROWS = [
  { label: 'потрачено', value: '$0.21' },
  { label: 'оценка до конца', value: '≈ $0.31' },
  { label: 'лимит прогона', value: '$1.00', muted: true },
];

const NOTE = 'риска превышения нет · стоп при $1.00 автоматически';

const NEAR_LIMIT_ROWS = [
  { label: 'потрачено', value: '$0.47' },
  { label: 'оценка до конца', value: '≈ $0.09' },
  { label: 'лимит прогона', value: '$1.00', muted: true },
];

const NEAR_LIMIT_NOTE = 'близко к лимиту · следующий шаг может остановить прогон';

export const cases: GalleryCase[] = [
  {
    title: 'на тёмном, обычный расход',
    node: <BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} />,
    dark: true,
  },
  {
    title: 'на светлом, обычный расход',
    node: <BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} onDark={false} />,
  },
  {
    title: 'на тёмном, близко к лимиту',
    node: <BudgetPanel rows={NEAR_LIMIT_ROWS} percent={48} limitAt={52} note={NEAR_LIMIT_NOTE} />,
    dark: true,
  },
  {
    title: 'на светлом, близко к лимиту',
    node: <BudgetPanel rows={NEAR_LIMIT_ROWS} percent={48} limitAt={52} note={NEAR_LIMIT_NOTE} onDark={false} />,
  },
  {
    title: 'узкая ширина',
    node: <BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} width={240} />,
    dark: true,
  },
  {
    title: 'широкая ширина',
    node: <BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} width={420} />,
    dark: true,
  },
];
