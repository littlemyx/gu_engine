import React from 'react';

import BranchRow from './BranchRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BranchRow';

export const cases: GalleryCase[] = [
  {
    title: 'нерактивная строка',
    dark: true,
    node: <BranchRow branch="Примирение" percent={68} />,
  },
  {
    title: 'кликабельная строка',
    dark: true,
    node: (
      <BranchRow
        branch="Побег"
        percent={40}
        onOpen={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
  {
    title: 'percent 0',
    dark: true,
    node: <BranchRow branch="Тупик" percent={0} />,
  },
  {
    title: 'percent 100',
    dark: true,
    node: <BranchRow branch="Финал" percent={100} />,
  },
];
