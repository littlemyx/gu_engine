import React from 'react';

import Kicker from './Kicker';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Kicker';

export const cases: GalleryCase[] = [
  { title: 'серый', node: <Kicker text="Лейбл поля" tone="neutral" /> },
  { title: 'accent', node: <Kicker text="Лейбл поля" tone="accent" /> },
  { title: 'error', node: <Kicker text="Лейбл поля" tone="error" /> },
  { title: 'серый · на тёмном', dark: true, node: <Kicker text="Лейбл поля" tone="neutral" onDark /> },
  { title: 'accent · на тёмном', dark: true, node: <Kicker text="Лейбл поля" tone="accent" onDark /> },
  { title: 'error · на тёмном', dark: true, node: <Kicker text="Лейбл поля" tone="error" onDark /> },
];
