import React from 'react';

import RunControls from './RunControls';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RunControls';

export const cases: GalleryCase[] = [
  { title: 'идёт прогон', node: <RunControls onPause={() => {}} onStop={() => {}} />, dark: true },
  { title: 'на паузе', node: <RunControls paused onPause={() => {}} onStop={() => {}} />, dark: true },
  { title: 'без onStop — стоп не интерактивен', node: <RunControls onPause={() => {}} />, dark: true },
  {
    title: 'свои подписи',
    node: (
      <RunControls
        pauseLabel="⏸ Пауза на границе акта"
        resumeLabel="▶ Возобновить"
        stopLabel="■ Прервать прогон"
        onPause={() => {}}
        onStop={() => {}}
      />
    ),
    dark: true,
  },
];
