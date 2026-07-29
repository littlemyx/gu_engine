import React from 'react';

import BeatCardGhost from './BeatCardGhost';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BeatCardGhost';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <BeatCardGhost label="Б5 · переносится в Д6у…" />,
  },
  {
    title: 'на тёмном',
    dark: true,
    node: <BeatCardGhost label="Б5 · переносится в Д6у…" onDark />,
  },
  {
    title: 'крупный размер',
    node: <BeatCardGhost label="Б12 · переносится в Д3а…" width={220} height={90} />,
  },
];
