import React from 'react';

import FillBadge from './FillBadge';

import type { GalleryCase } from '../galleryTypes';

export const title = 'FillBadge';

export const cases: GalleryCase[] = [
  { title: 'заливка', node: <FillBadge label="ВЫБРАНА" /> },
  { title: 'со стрелкой раскрытия', node: <FillBadge label="есть v3 · diff" arrow /> },
  { title: 'без верхнего регистра', node: <FillBadge label="выбрана" uppercase={false} /> },
  { title: 'заливка · на тёмном', dark: true, node: <FillBadge label="ВЫБРАНА" /> },
  { title: 'со стрелкой · на тёмном', dark: true, node: <FillBadge label="есть v3 · diff" arrow /> },
];
