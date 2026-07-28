import React from 'react';

import TokenHighlight from './TokenHighlight';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TokenHighlight';

export const cases: GalleryCase[] = [
  {
    title: 'в предложении',
    node: <TokenHighlight token="biome" before="Опиши локацию" after="в тоне сеттинга." />,
  },
  {
    title: 'только токен',
    node: <TokenHighlight token="biome" inSentence={false} />,
  },
  {
    title: 'в предложении · на тёмном',
    dark: true,
    node: <TokenHighlight token="biome" before="Опиши локацию" after="в тоне сеттинга." onDark />,
  },
  {
    title: 'только токен · на тёмном',
    dark: true,
    node: <TokenHighlight token="biome" inSentence={false} onDark />,
  },
];
