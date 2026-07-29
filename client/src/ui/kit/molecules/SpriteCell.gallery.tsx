import React from 'react';

import SpriteCell from './SpriteCell';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SpriteCell';

export const cases: GalleryCase[] = [
  {
    title: 'принят',
    node: <SpriteCell label="идл · №2" state="accepted" />,
  },
  {
    title: 'ожидает',
    node: <SpriteCell label="joy" state="awaiting" />,
  },
  {
    title: 'принят, кликабельна',
    node: <SpriteCell label="идл · №2" state="accepted" onClick={() => {}} />,
  },
  {
    title: 'ожидает, кликабельна',
    node: <SpriteCell label="joy" state="awaiting" onClick={() => {}} />,
  },
  {
    title: 'некликабельная ячейка (без onClick)',
    node: <SpriteCell label="сидит · №1" state="awaiting" />,
  },
  {
    title: 'увеличенный размер (width/height)',
    node: <SpriteCell label="крупный план" state="accepted" width={100} height={150} />,
  },
];
