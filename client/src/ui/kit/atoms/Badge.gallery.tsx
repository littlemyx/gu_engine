import React from 'react';

import Badge from './Badge';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Badge';

export const cases: GalleryCase[] = [
  { title: 'neutral', node: <Badge label="authored" glyph="✎" /> },
  { title: 'accent', node: <Badge label="linked" glyph="⇄" tone="accent" /> },
  { title: 'error', node: <Badge label="stale" glyph="◐" tone="error" /> },
  { title: 'neutral · на тёмном', dark: true, node: <Badge label="authored" glyph="✎" onDark /> },
  { title: 'accent · на тёмном', dark: true, node: <Badge label="linked" glyph="⇄" tone="accent" onDark /> },
  { title: 'error · на тёмном', dark: true, node: <Badge label="stale" glyph="◐" tone="error" onDark /> },
  { title: 'без глифа', node: <Badge label="префаб" /> },
  { title: 'plain · neutral', node: <Badge label="заперт" variant="plain" /> },
  { title: 'plain · accent', node: <Badge label="проза ✓" tone="accent" variant="plain" /> },
  { title: 'plain · error', node: <Badge label="нет прозы" glyph="▨" tone="error" variant="plain" /> },
  {
    title: 'plain · на тёмном',
    dark: true,
    node: <Badge label="генерируется" glyph="⟳" tone="accent" variant="plain" onDark />,
  },
];
