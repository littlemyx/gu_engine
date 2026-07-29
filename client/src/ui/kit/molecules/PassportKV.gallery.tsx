import React from 'react';

import PassportKV from './PassportKV';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PassportKV';

const DEFAULT_ROWS = [
  { key: 'модель', value: 'gpt-4.1-mini', format: 'mono' as const },
  { key: 'стоимость', value: '$0.014 · 2 попытки' },
  { key: 'проверки', value: '8/8 ✓ · критик ✓' },
  { key: 'статус', value: 'валиден, в бандл', format: 'accent' as const },
];

export const cases: GalleryCase[] = [
  {
    title: 'на светлом · по умолчанию',
    node: <PassportKV rows={DEFAULT_ROWS} />,
  },
  {
    title: 'на тёмном',
    node: <PassportKV rows={DEFAULT_ROWS} onDark />,
    dark: true,
  },
  {
    title: 'узкая колонка ключа (labelWidth)',
    node: <PassportKV rows={DEFAULT_ROWS} labelWidth={48} width={220} onDark />,
    dark: true,
  },
  {
    title: 'только plain-значения',
    node: (
      <PassportKV
        rows={[
          { key: 'жанр', value: 'нуар-детектив' },
          { key: 'сеттинг', value: 'портовый город, 1930-е' },
        ]}
        onDark
      />
    ),
    dark: true,
  },
];
