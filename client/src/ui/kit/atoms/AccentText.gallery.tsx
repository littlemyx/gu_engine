import React from 'react';

import AccentText from './AccentText';

import type { GalleryCase } from '../galleryTypes';

export const title = 'AccentText';

export const cases: GalleryCase[] = [
  { title: 'info', node: <AccentText text="значение изменено" tone="info" /> },
  { title: 'accent', node: <AccentText text="значение изменено" tone="accent" /> },
  { title: 'error', node: <AccentText text="значение изменено" tone="error" /> },
  { title: 'warn', node: <AccentText text="значение изменено" tone="warn" /> },
  { title: 'bold', node: <AccentText text="значение изменено" bold /> },
  { title: 'крупный кегль', node: <AccentText text="значение изменено" size={14} /> },
  { title: 'info · на тёмном', dark: true, node: <AccentText text="значение изменено" tone="info" onDark /> },
  { title: 'accent · на тёмном', dark: true, node: <AccentText text="значение изменено" tone="accent" onDark /> },
  { title: 'error · на тёмном', dark: true, node: <AccentText text="значение изменено" tone="error" onDark /> },
  { title: 'warn · на тёмном', dark: true, node: <AccentText text="значение изменено" tone="warn" onDark /> },
];
