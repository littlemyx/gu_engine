import React from 'react';

import DraftBadge from './DraftBadge';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DraftBadge';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <DraftBadge text="черновик · прогон #13 идёт" />,
  },
  {
    title: 'на тёмном',
    dark: true,
    node: <DraftBadge text="черновик · прогон #13 идёт" onDark />,
  },
];
