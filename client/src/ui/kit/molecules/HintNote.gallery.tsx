import React from 'react';

import HintNote from './HintNote';

import type { GalleryCase } from '../galleryTypes';

export const title = 'HintNote';

const SAMPLE_TEXT = 'Версии иммутабельны. Проект держит локальный снапшот закастованной версии.';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <HintNote text={SAMPLE_TEXT} />,
  },
  {
    title: 'на тёмном',
    dark: true,
    node: <HintNote text={SAMPLE_TEXT} onDark />,
  },
  {
    title: 'узкая ширина',
    node: <HintNote text={SAMPLE_TEXT} width={200} />,
  },
  {
    title: 'широкая ширина',
    node: <HintNote text={SAMPLE_TEXT} width={440} />,
  },
];
