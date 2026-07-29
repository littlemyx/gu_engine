import React from 'react';

import CostTable from './CostTable';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CostTable';

const ROWS = [
  { label: 'план (хребет + каст + мир)', value: '≈ $0.08' },
  { label: 'диалоги + проза · 21 слот', value: '≈ $0.44' },
  { label: 'медиа · 6 фонов + аудио', value: '≈ $0.19' },
];

const TOTAL = { label: 'итого до бандла', value: '≈ $0.71' };

export const cases: GalleryCase[] = [
  {
    title: 'на тёмном, с итогом',
    node: <CostTable rows={ROWS} total={TOTAL} />,
    dark: true,
  },
  {
    title: 'на тёмном, без итога',
    node: <CostTable rows={ROWS} />,
    dark: true,
  },
  {
    title: 'на светлом, с итогом',
    node: <CostTable rows={ROWS} total={TOTAL} onDark={false} />,
  },
  {
    title: 'на светлом, без итога',
    node: <CostTable rows={ROWS} onDark={false} />,
  },
  {
    title: 'узкая ширина',
    node: <CostTable rows={ROWS} total={TOTAL} width={220} />,
    dark: true,
  },
  {
    title: 'широкая ширина',
    node: <CostTable rows={ROWS} total={TOTAL} width={420} />,
    dark: true,
  },
];
