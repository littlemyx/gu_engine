import React from 'react';

import StatusGlyph from './StatusGlyph';

import type { GalleryCase } from '../galleryTypes';

export const title = 'StatusGlyph';

export const cases: GalleryCase[] = [
  { title: 'fresh', node: <StatusGlyph status="fresh" /> },
  { title: 'stale', node: <StatusGlyph status="stale" /> },
  { title: 'none', node: <StatusGlyph status="none" /> },
  { title: 'ok', node: <StatusGlyph status="ok" /> },
  { title: 'run (spin)', node: <StatusGlyph status="run" /> },
  { title: 'run (без spin)', node: <StatusGlyph status="run" spin={false} /> },
  { title: 'fail', node: <StatusGlyph status="fail" /> },
  { title: 'warn', node: <StatusGlyph status="warn" /> },
  { title: 'крупный кегль (18px)', node: <StatusGlyph status="fresh" size={18} /> },
  { title: 'fresh · на тёмном', dark: true, node: <StatusGlyph status="fresh" onDark /> },
  { title: 'stale · на тёмном', dark: true, node: <StatusGlyph status="stale" onDark /> },
  { title: 'none · на тёмном', dark: true, node: <StatusGlyph status="none" onDark /> },
  { title: 'ok · на тёмном', dark: true, node: <StatusGlyph status="ok" onDark /> },
  { title: 'run · на тёмном', dark: true, node: <StatusGlyph status="run" onDark /> },
  { title: 'fail · на тёмном', dark: true, node: <StatusGlyph status="fail" onDark /> },
  { title: 'warn · на тёмном', dark: true, node: <StatusGlyph status="warn" onDark /> },
];
