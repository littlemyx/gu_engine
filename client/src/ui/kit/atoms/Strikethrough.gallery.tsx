import React from 'react';

import Strikethrough from './Strikethrough';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Strikethrough';

export const cases: GalleryCase[] = [
  {
    title: 'accent',
    node: <Strikethrough oldValue="≈$0.04" newValue="≈$0.02" newTone="accent" />,
  },
  {
    title: 'plain',
    node: <Strikethrough oldValue="≈$0.04" newValue="≈$0.02" newTone="plain" />,
  },
  {
    title: 'без нового значения',
    node: <Strikethrough oldValue="≈$0.04" />,
  },
  {
    title: 'accent · на тёмном',
    dark: true,
    node: <Strikethrough oldValue="≈$0.04" newValue="≈$0.02" newTone="accent" onDark />,
  },
  {
    title: 'plain · на тёмном',
    dark: true,
    node: <Strikethrough oldValue="≈$0.04" newValue="≈$0.02" newTone="plain" onDark />,
  },
  {
    title: 'без нового значения · на тёмном',
    dark: true,
    node: <Strikethrough oldValue="≈$0.04" onDark />,
  },
];
