import React from 'react';

import MatrixHeader from './MatrixHeader';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MatrixHeader';

const WEEK = [
  { name: 'День 1' },
  { name: 'День 2' },
  { name: 'День 3' },
  { name: 'Д4 ◈' },
  { name: 'День 5' },
  { name: 'День 6' },
  { name: 'День 7' },
];

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · день 4 активен',
    node: <MatrixHeader days={WEEK} activeDay={4} />,
  },
  {
    title: 'без активного дня',
    node: <MatrixHeader days={WEEK} activeDay={0} />,
  },
  {
    title: 'две фазы на день, свои подписи',
    node: (
      <MatrixHeader
        days={WEEK.slice(0, 4)}
        activeDay={2}
        phasesPerDay={2}
        phaseLabels={['день', 'ночь']}
        slotWidth={40}
      />
    ),
  },
  {
    title: 'узкие колонки, короткая неделя',
    node: <MatrixHeader days={WEEK.slice(0, 3)} activeDay={1} slotWidth={24} />,
  },
  {
    title: 'на тёмном хроме',
    node: <MatrixHeader days={WEEK} activeDay={5} onDark />,
    dark: true,
  },
];
