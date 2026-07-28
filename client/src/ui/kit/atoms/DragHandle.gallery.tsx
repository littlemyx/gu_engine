import React from 'react';

import DragHandle from './DragHandle';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DragHandle';

export const cases: GalleryCase[] = [
  { title: 'по умолчанию', node: <DragHandle /> },
  { title: 'крупный (14px)', node: <DragHandle size={14} /> },
  { title: 'на тёмном', dark: true, node: <DragHandle onDark /> },
  { title: 'на тёмном · крупный (14px)', dark: true, node: <DragHandle onDark size={14} /> },
];
