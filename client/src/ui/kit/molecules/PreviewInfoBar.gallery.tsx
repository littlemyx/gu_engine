import React from 'react';

import PreviewInfoBar from './PreviewInfoBar';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PreviewInfoBar';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию',
    dark: true,
    node: (
      <PreviewInfoBar
        items={[{ text: 'превью: движок = релизный' }, { text: 'persist: off' }]}
        right="seed 12345 · снапшотов 14"
      />
    ),
  },
  {
    title: 'много сегментов',
    dark: true,
    node: (
      <PreviewInfoBar
        items={[{ text: 'превью: движок = черновой' }, { text: 'persist: on' }, { text: 'ветка: развилка-3' }]}
        right="seed 90210 · снапшотов 2"
      />
    ),
  },
  {
    title: 'без правой сводки',
    dark: true,
    node: <PreviewInfoBar items={[{ text: 'превью: движок = релизный' }, { text: 'persist: off' }]} />,
  },
  {
    title: 'без сегментов',
    dark: true,
    node: <PreviewInfoBar items={[]} right="seed —" />,
  },
];
