import React from 'react';

import Logo from './Logo';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Logo';

export const cases: GalleryCase[] = [
  { title: 'muted', node: <Logo text="GU Engine" tone="muted" /> },
  { title: 'contrast', node: <Logo text="GU Engine" tone="contrast" /> },
  { title: 'крупный кегль', node: <Logo text="GU Engine" size={20} /> },
  { title: 'muted · на тёмном', dark: true, node: <Logo text="GU Engine" tone="muted" onDark /> },
  { title: 'contrast · на тёмном', dark: true, node: <Logo text="GU Engine" tone="contrast" onDark /> },
];
