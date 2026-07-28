import React from 'react';

import CheckGlyph from './CheckGlyph';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CheckGlyph';

export const cases: GalleryCase[] = [
  { title: 'ok', node: <CheckGlyph tone="ok" /> },
  { title: 'muted', node: <CheckGlyph tone="muted" /> },
  { title: 'ok · на тёмном', dark: true, node: <CheckGlyph tone="ok" onDark /> },
  { title: 'muted · на тёмном', dark: true, node: <CheckGlyph tone="muted" onDark /> },
];
