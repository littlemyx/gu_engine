import React from 'react';

import Connector from './Connector';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Connector';

export const cases: GalleryCase[] = [
  { title: 'основной', node: <Connector kind="основной" length={160} /> },
  { title: 'ветвление dashed', node: <Connector kind="ветвление" length={160} /> },
  { title: 'маршрут 2.5px', node: <Connector kind="маршрут" length={160} /> },
  { title: 'с изломом', node: <Connector kind="основной" length={160} elbow /> },
  { title: 'нейтральный тон', node: <Connector kind="основной" tone="нейтральный" length={160} /> },
];
