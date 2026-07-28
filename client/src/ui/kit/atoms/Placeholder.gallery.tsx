import React from 'react';

import Placeholder from './Placeholder';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Placeholder';

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <Placeholder text="выбрать локацию…" /> },
  { title: 'на тёмном', dark: true, node: <Placeholder text="выбрать локацию…" onDark /> },
  { title: 'крупный кегль (12px)', node: <Placeholder text="выбрать локацию…" size={12} /> },
];
