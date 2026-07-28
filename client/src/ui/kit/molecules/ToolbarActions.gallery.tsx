import React from 'react';

import ToolbarActions from './ToolbarActions';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ToolbarActions';

export const cases: GalleryCase[] = [
  { title: 'по умолчанию', node: <ToolbarActions />, dark: true },
  { title: 'предпросмотр включён', node: <ToolbarActions previewActive />, dark: true },
  { title: 'загрузка', node: <ToolbarActions loading />, dark: true },
  { title: 'заперто', node: <ToolbarActions disabled />, dark: true },
  {
    title: 'свои тексты',
    node: <ToolbarActions label="Сгенерировать акт" price="≈$1.10" previewLabel="Смотреть" previewActive />,
    dark: true,
  },
];
