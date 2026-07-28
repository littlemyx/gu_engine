import React from 'react';

import Glyph from './Glyph';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Glyph';

export const cases: GalleryCase[] = [
  { title: 'neutral (декоративный)', node: <Glyph glyph="◈" tone="neutral" /> },
  { title: 'accent (декоративный)', node: <Glyph glyph="●" tone="accent" /> },
  { title: 'muted (декоративный)', node: <Glyph glyph="⠿" tone="muted" /> },
  { title: 'info', node: <Glyph glyph="▸" tone="info" /> },
  { title: 'error (статусный)', node: <Glyph glyph="✕" tone="error" /> },
  { title: 'warn (статусный)', node: <Glyph glyph="◐" tone="warn" /> },
  {
    title: 'neutral · на тёмном',
    dark: true,
    node: <Glyph glyph="◈" tone="neutral" onDark />,
  },
  {
    title: 'accent · на тёмном',
    dark: true,
    node: <Glyph glyph="●" tone="accent" onDark />,
  },
  {
    title: 'muted · на тёмном',
    dark: true,
    node: <Glyph glyph="⠿" tone="muted" onDark />,
  },
  {
    title: 'info · на тёмном',
    dark: true,
    node: <Glyph glyph="▸" tone="info" onDark />,
  },
  {
    title: 'error · на тёмном',
    dark: true,
    node: <Glyph glyph="✕" tone="error" onDark />,
  },
  {
    title: 'warn · на тёмном',
    dark: true,
    node: <Glyph glyph="◐" tone="warn" onDark />,
  },
  { title: 'размер 20px', node: <Glyph glyph="♪" tone="accent" size={20} /> },
];
