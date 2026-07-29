import React from 'react';

import InplacePreview from './InplacePreview';

import type { GalleryCase } from '../galleryTypes';

export const title = 'InplacePreview';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию (236×66)',
    node: (
      <InplacePreview
        caption="пирс, вечер · ▣ из префаба «Взморье» v1"
        note="строка развёрнута по ▸ — без отдельного окна"
      />
    ),
  },
  {
    title: 'меньший размер плашки',
    node: (
      <InplacePreview caption="кафе, день" note="thumbWidth/thumbHeight уменьшены" thumbWidth={140} thumbHeight={44} />
    ),
  },
  {
    title: 'на тёмной панели',
    dark: true,
    node: (
      <InplacePreview
        caption="пирс, вечер · ▣ из префаба «Взморье» v1"
        note="строка развёрнута по ▸ — без отдельного окна"
        onDark
      />
    ),
  },
];
