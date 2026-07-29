import React from 'react';

import GameViewport from './GameViewport';

import type { GalleryCase } from '../galleryTypes';

export const title = 'GameViewport';

export const cases: GalleryCase[] = [
  {
    title: 'обычный показ',
    node: <GameViewport />,
    dark: true,
  },
  {
    title: 'без персонажа',
    node: <GameViewport showChar={false} />,
    dark: true,
  },
  {
    title: 'без диалога',
    node: <GameViewport showDialogue={false} />,
    dark: true,
  },
  {
    title: 'выбор вариантов кликабелен',
    node: <GameViewport selected={1} onChoicePick={() => {}} />,
    dark: true,
  },
  {
    title: 'оверлей: тихая пересборка',
    node: <GameViewport overlay="пересборка" />,
    dark: true,
  },
  {
    title: 'оверлей: строгий режим',
    node: <GameViewport overlay="строгий" />,
    dark: true,
  },
  {
    title: 'уменьшенный кадр',
    node: <GameViewport width={480} height={260} />,
    dark: true,
  },
];
