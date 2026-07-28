import React from 'react';

import NotifyDot from './NotifyDot';

import type { GalleryCase } from '../galleryTypes';

export const title = 'NotifyDot';

export const cases: GalleryCase[] = [
  { title: 'жёлтый', node: <NotifyDot tone="yellow" /> },
  { title: 'accent', node: <NotifyDot tone="accent" /> },
  { title: 'error', node: <NotifyDot tone="error" /> },
  { title: 'размер 10px', node: <NotifyDot tone="yellow" size={10} /> },
  { title: 'жёлтый · на тёмном', dark: true, node: <NotifyDot tone="yellow" onDark /> },
  { title: 'accent · на тёмном', dark: true, node: <NotifyDot tone="accent" onDark /> },
  { title: 'error · на тёмном', dark: true, node: <NotifyDot tone="error" onDark /> },
];
