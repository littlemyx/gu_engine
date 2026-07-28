import React from 'react';

import Letterform from './Letterform';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Letterform';

export const cases: GalleryCase[] = [
  { title: 'outline', node: <Letterform letter="A" /> },
  { title: 'outline · selected', node: <Letterform letter="Б4" selected /> },
  { title: 'filled', node: <Letterform letter="С3" variant="filled" /> },
  { title: 'outline · на тёмном', dark: true, node: <Letterform letter="A" onDark /> },
  { title: 'outline · selected · на тёмном', dark: true, node: <Letterform letter="Б4" selected onDark /> },
  { title: 'filled · на тёмном', dark: true, node: <Letterform letter="С3" variant="filled" onDark /> },
];
