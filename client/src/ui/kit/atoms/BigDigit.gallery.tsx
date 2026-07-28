import React from 'react';

import BigDigit from './BigDigit';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BigDigit';

export const cases: GalleryCase[] = [
  { title: 'normal', node: <BigDigit value="14" unit="битов" /> },
  { title: 'accent', node: <BigDigit value="7" tone="accent" unit="сцен" /> },
  { title: 'quiet', node: <BigDigit value="42" tone="quiet" unit="строк" /> },
  { title: 'без единицы', node: <BigDigit value="128" /> },
  { title: 'крупный кегль', node: <BigDigit value="9" unit="актов" size={64} /> },
  { title: 'normal · на тёмном', dark: true, node: <BigDigit value="14" unit="битов" onDark /> },
  { title: 'accent · на тёмном', dark: true, node: <BigDigit value="7" tone="accent" unit="сцен" onDark /> },
  { title: 'quiet · на тёмном', dark: true, node: <BigDigit value="42" tone="quiet" unit="строк" onDark /> },
];
