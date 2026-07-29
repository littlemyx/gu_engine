import React from 'react';

import PanelFootnote from './PanelFootnote';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PanelFootnote';

export const cases: GalleryCase[] = [
  {
    title: 'на тёмном',
    dark: true,
    node: <PanelFootnote text="черновик · сохранено автоматически" />,
  },
  {
    title: 'на светлом',
    node: <PanelFootnote text="черновик · сохранено автоматически" onDark={false} />,
  },
];
