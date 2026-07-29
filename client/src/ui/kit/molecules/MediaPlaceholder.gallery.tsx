import React from 'react';

import MediaPlaceholder from './MediaPlaceholder';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MediaPlaceholder';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <MediaPlaceholder label="фон «пирс, закат» — заглушка" />,
  },
  {
    title: 'на тёмном',
    node: <MediaPlaceholder label="фон «пирс, закат» — заглушка" onDark />,
    dark: true,
  },
  {
    title: 'длинная подпись, на тёмном',
    node: <MediaPlaceholder label="портрет героя, крупный план, вечернее освещение — заглушка" onDark />,
    dark: true,
  },
];
