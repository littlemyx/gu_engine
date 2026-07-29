import React from 'react';

import EstimateTotal from './EstimateTotal';

import type { GalleryCase } from '../galleryTypes';

export const title = 'EstimateTotal';

export const cases: GalleryCase[] = [
  { title: 'обычный размер', node: <EstimateTotal label="итого" price="≈$1.04–1.35" /> },
  { title: 'крупный размер', node: <EstimateTotal label="итого" price="≈$1.04–1.35" size="large" /> },
  { title: 'accent — сумма акцентным тоном', node: <EstimateTotal label="итого" price="≈$3.46" accent /> },
  {
    title: 'крупный · accent',
    node: <EstimateTotal label="итого за прогон" price="≈$3.46" size="large" accent />,
  },
];
