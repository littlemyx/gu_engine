import React from 'react';

import ConflictNote from './ConflictNote';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ConflictNote';

const SAMPLE_TEXT = '▣ × ◐ — конфликт: залочено и устарело. Система не решает — решаете вы.';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <ConflictNote text={SAMPLE_TEXT} />,
  },
  {
    title: 'на тёмном',
    dark: true,
    node: <ConflictNote text={SAMPLE_TEXT} onDark />,
  },
];
