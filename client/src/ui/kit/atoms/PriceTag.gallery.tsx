import React from 'react';

import PriceTag from './PriceTag';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PriceTag';

export const cases: GalleryCase[] = [
  { title: 'в кнопке', node: <PriceTag value="≈$0.02" variant="button" /> },
  { title: 'отдельно', node: <PriceTag value="≈$0.02" variant="standalone" /> },
  { title: 'итог', node: <PriceTag value="≈$3.46" variant="total" /> },
  { title: 'в кнопке · на тёмном', dark: true, node: <PriceTag value="≈$0.02" variant="button" onDark /> },
  { title: 'отдельно · на тёмном', dark: true, node: <PriceTag value="≈$0.02" variant="standalone" onDark /> },
  { title: 'итог · на тёмном', dark: true, node: <PriceTag value="≈$3.46" variant="total" onDark /> },
];
