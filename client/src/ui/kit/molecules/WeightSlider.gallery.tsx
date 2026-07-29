import React from 'react';

import WeightSlider from './WeightSlider';

import type { GalleryCase } from '../galleryTypes';

export const title = 'WeightSlider';

export const cases: GalleryCase[] = [
  { title: 'на светлом, среднее значение', node: <WeightSlider label="агрессия" value={40} /> },
  { title: 'на светлом, край — 0', node: <WeightSlider label="осторожность" value={0} /> },
  { title: 'на светлом, край — 100', node: <WeightSlider label="решительность" value={100} /> },
  {
    title: 'на светлом, кастомная строка значения',
    node: <WeightSlider label="громкость" value={40} valueText="0.40" />,
  },
  { title: 'на светлом, disabled', node: <WeightSlider label="агрессия" value={40} disabled /> },
  {
    title: 'на тёмном, среднее значение',
    node: <WeightSlider label="агрессия" value={40} onDark />,
    dark: true,
  },
  {
    title: 'на тёмном, край — 0',
    node: <WeightSlider label="осторожность" value={0} onDark />,
    dark: true,
  },
  {
    title: 'на тёмном, disabled',
    node: <WeightSlider label="агрессия" value={40} onDark disabled />,
    dark: true,
  },
];
