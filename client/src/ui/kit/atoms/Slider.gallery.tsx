import React from 'react';

import Slider from './Slider';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Slider';

const Box = ({ children }: { children: React.ReactNode }) => <div style={{ width: 200 }}>{children}</div>;

export const cases: GalleryCase[] = [
  {
    title: 'горизонтальный (regular)',
    node: (
      <Box>
        <Slider label="вес" value={62} />
      </Box>
    ),
  },
  {
    title: 'мини-регулятор',
    node: (
      <Box>
        <Slider label="громкость" value={35} size="mini" />
      </Box>
    ),
  },
  {
    title: 'без подписи',
    node: (
      <Box>
        <Slider label="вес" value={50} showLabel={false} />
      </Box>
    ),
  },
  {
    title: 'disabled',
    node: (
      <Box>
        <Slider label="вес" value={20} disabled />
      </Box>
    ),
  },
  {
    title: 'горизонтальный · на тёмном',
    dark: true,
    node: (
      <Box>
        <Slider label="вес" value={70} onDark />
      </Box>
    ),
  },
  {
    title: 'мини-регулятор · на тёмном',
    dark: true,
    node: (
      <Box>
        <Slider label="громкость" value={45} size="mini" onDark />
      </Box>
    ),
  },
  {
    title: 'disabled · на тёмном',
    dark: true,
    node: (
      <Box>
        <Slider label="вес" value={20} disabled onDark />
      </Box>
    ),
  },
];
