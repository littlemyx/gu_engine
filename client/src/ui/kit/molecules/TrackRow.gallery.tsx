import React from 'react';

import TrackRow from './TrackRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TrackRow';

export const cases: GalleryCase[] = [
  {
    title: 'не выбран, немой индикатор',
    node: <TrackRow label="Вариант A" time="2:47" />,
  },
  {
    title: 'выбран, немой индикатор',
    node: <TrackRow label="Вариант A" time="2:47" selected />,
  },
  {
    title: 'кликабельный, не выбран',
    node: <TrackRow label="Вариант B" time="1:12" onSelect={() => {}} onPlay={() => {}} />,
  },
  {
    title: 'кликабельный, выбран',
    node: <TrackRow label="Вариант A" time="2:47" selected onSelect={() => {}} onPlay={() => {}} />,
  },
  {
    title: 'только воспроизведение, без выбора строки',
    node: <TrackRow label="Вариант C" time="0:38" onPlay={() => {}} />,
  },
];
