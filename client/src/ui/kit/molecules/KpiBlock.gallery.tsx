import React from 'react';

import KpiBlock from './KpiBlock';

import type { GalleryCase } from '../galleryTypes';

export const title = 'KpiBlock';

export const cases: GalleryCase[] = [
  {
    title: 'обычный набор',
    node: (
      <KpiBlock
        items={[
          { value: '2', label: 'блокера', tone: 'normal' },
          { value: '12', label: 'заметки', tone: 'accent' },
          { value: 'D4', label: 'тихий', tone: 'quiet' },
        ]}
      />
    ),
  },
  {
    title: 'крупный кегль',
    node: (
      <KpiBlock
        items={[
          { value: '7', label: 'сцен готово', tone: 'accent' },
          { value: '0', label: 'провалов', tone: 'normal' },
        ]}
        size={34}
      />
    ),
  },
  {
    title: 'мелкий кегль',
    node: (
      <KpiBlock
        items={[
          { value: '3', label: 'ветки', tone: 'normal' },
          { value: '1', label: 'тупик', tone: 'quiet' },
        ]}
        size={16}
      />
    ),
  },
  {
    title: 'один пункт',
    node: <KpiBlock items={[{ value: '128', label: 'реплик', tone: 'accent' }]} />,
  },
  {
    title: 'на тёмном хроме',
    dark: true,
    node: (
      <KpiBlock
        items={[
          { value: '2', label: 'блокера', tone: 'normal' },
          { value: '12', label: 'заметки', tone: 'accent' },
          { value: 'D4', label: 'тихий', tone: 'quiet' },
        ]}
        onDark
      />
    ),
  },
];
