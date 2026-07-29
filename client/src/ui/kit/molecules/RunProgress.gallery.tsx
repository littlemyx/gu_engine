import React from 'react';

import RunProgress from './RunProgress';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RunProgress';

export const cases: GalleryCase[] = [
  {
    title: 'обычный · в процессе',
    node: <RunProgress percent={54} label="14 из 26 · $0.41" />,
  },
  {
    title: 'ошибка',
    node: <RunProgress percent={38} label="6 из 26 · остановлен" tone="error" />,
  },
  {
    title: 'почти готово',
    node: <RunProgress percent={92} label="24 из 26 · $0.87" />,
  },
  {
    title: 'обычный · на тёмном',
    dark: true,
    node: <RunProgress percent={54} label="14 из 26 · $0.41" onDark />,
  },
  {
    title: 'ошибка · на тёмном',
    dark: true,
    node: <RunProgress percent={38} label="6 из 26 · остановлен" tone="error" onDark />,
  },
];
