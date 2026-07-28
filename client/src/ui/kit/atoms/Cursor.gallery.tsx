import React from 'react';

import Cursor from './Cursor';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Cursor';

export const cases: GalleryCase[] = [
  { title: 'plain', node: <Cursor /> },
  { title: 'accent', node: <Cursor tone="accent" /> },
  { title: 'без мигания (blink=false)', node: <Cursor blink={false} /> },
  { title: 'крупный кегль (size=16)', node: <Cursor size={16} /> },
  { title: 'plain · на тёмном', dark: true, node: <Cursor onDark /> },
  { title: 'accent · на тёмном', dark: true, node: <Cursor tone="accent" onDark /> },
];
