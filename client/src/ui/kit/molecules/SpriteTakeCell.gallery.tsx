import React from 'react';

import SpriteTakeCell from './SpriteTakeCell';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SpriteTakeCell';

export const cases: GalleryCase[] = [
  {
    title: 'принят',
    node: <SpriteTakeCell num={2} label="принят" state="accepted" />,
  },
  {
    title: 'обычная',
    node: <SpriteTakeCell num={3} label="#12" state="ordinary" />,
  },
  {
    title: 'принят, кликабельна',
    node: <SpriteTakeCell num={2} label="принят" state="accepted" onClick={() => {}} />,
  },
  {
    title: 'обычная, кликабельна',
    node: <SpriteTakeCell num={3} label="#12" state="ordinary" onClick={() => {}} />,
  },
  {
    title: 'некликабельная ячейка (без onClick)',
    node: <SpriteTakeCell num={5} label="#7" state="ordinary" />,
  },
  {
    title: 'увеличенный размер (width/height)',
    node: <SpriteTakeCell num={2} label="принят" state="accepted" width={220} height={150} />,
  },
  {
    title: 'ширина на весь контейнер (width="fill")',
    node: <SpriteTakeCell num={2} label="принят" state="accepted" width="fill" />,
  },
];
