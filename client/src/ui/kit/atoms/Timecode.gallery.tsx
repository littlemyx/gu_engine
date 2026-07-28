import React from 'react';

import Timecode from './Timecode';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Timecode';

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <Timecode value="0:34" /> },
  { title: 'на светлом · muted', node: <Timecode value="0:34" muted /> },
  { title: 'на тёмном', dark: true, node: <Timecode value="0:34" onDark /> },
  { title: 'на тёмном · muted', dark: true, node: <Timecode value="0:34" onDark muted /> },
  { title: 'пара 0:34 / 1:48', node: <Timecode value="0:34 / 1:48" /> },
  { title: 'крупный кегль (13px)', node: <Timecode value="1:48" size={13} /> },
];
