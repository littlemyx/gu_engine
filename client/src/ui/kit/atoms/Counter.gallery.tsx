import React from 'react';

import Counter from './Counter';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Counter';

export const cases: GalleryCase[] = [
  { title: 'neutral', node: <Counter value="4/9" /> },
  { title: 'статусный · accent', node: <Counter value="4/9" tone="accent" /> },
  { title: 'статусный · warn', node: <Counter value="8/9" tone="warn" /> },
  { title: 'статусный · error', node: <Counter value="9/9" tone="error" /> },
  { title: 'формат ×n', node: <Counter value="×3" tone="accent" /> },
  { title: 'neutral · на тёмном', dark: true, node: <Counter value="4/9" onDark /> },
  { title: 'статусный · accent · на тёмном', dark: true, node: <Counter value="4/9" tone="accent" onDark /> },
  { title: 'статусный · warn · на тёмном', dark: true, node: <Counter value="8/9" tone="warn" onDark /> },
  { title: 'статусный · error · на тёмном', dark: true, node: <Counter value="9/9" tone="error" onDark /> },
];
