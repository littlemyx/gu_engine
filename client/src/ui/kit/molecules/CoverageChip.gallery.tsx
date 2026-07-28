import React from 'react';

import CoverageChip from './CoverageChip';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CoverageChip';

export const cases: GalleryCase[] = [
  { title: 'ок', node: <CoverageChip label="4 юнита" state="ok" /> },
  { title: 'предупреждение', node: <CoverageChip label="2 юнита" state="warn" /> },
  { title: 'ошибка', node: <CoverageChip label="0 юнитов" state="error" /> },
  { title: 'ок · на тёмном', node: <CoverageChip label="4 юнита" state="ok" onDark />, dark: true },
  {
    title: 'предупреждение · на тёмном',
    node: <CoverageChip label="2 юнита" state="warn" onDark />,
    dark: true,
  },
  { title: 'ошибка · на тёмном', node: <CoverageChip label="0 юнитов" state="error" onDark />, dark: true },
];
