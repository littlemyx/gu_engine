import React from 'react';

import Thumbnail from './Thumbnail';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Thumbnail';

export const cases: GalleryCase[] = [
  { title: 'спрайт 32×46', node: <Thumbnail kind="sprite" label="идл" /> },
  { title: 'спрайт · selected', node: <Thumbnail kind="sprite" label="joy" selected /> },
  { title: 'локация 56×34', node: <Thumbnail kind="location" label="пирс" /> },
  { title: '+N заглушка', node: <Thumbnail kind="stub" label="+3" /> },
  { title: 'спрайт · на тёмном', dark: true, node: <Thumbnail kind="sprite" label="идл" onDark /> },
  { title: 'спрайт · selected · на тёмном', dark: true, node: <Thumbnail kind="sprite" label="joy" selected onDark /> },
  { title: 'локация · на тёмном', dark: true, node: <Thumbnail kind="location" label="кафе" onDark /> },
  { title: '+N заглушка · на тёмном', dark: true, node: <Thumbnail kind="stub" label="+3" onDark /> },
];
