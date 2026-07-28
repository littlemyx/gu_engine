import React from 'react';

import PanelInfoBox from './PanelInfoBox';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PanelInfoBox';

export const cases: GalleryCase[] = [
  { title: 'на тёмном (сайдбар)', dark: true, node: <PanelInfoBox text="Дальше: следующий шаг зоны" /> },
  { title: 'на светлом', node: <PanelInfoBox text="Дальше: следующий шаг зоны" onDark={false} /> },
];
