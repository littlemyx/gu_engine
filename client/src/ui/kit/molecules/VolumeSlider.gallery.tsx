import React from 'react';

import VolumeSlider from './VolumeSlider';

import type { GalleryCase } from '../galleryTypes';

export const title = 'VolumeSlider';

const Box = ({ children }: { children: React.ReactNode }) => <div style={{ width: 200 }}>{children}</div>;

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: (
      <Box>
        <VolumeSlider label="vol" value={45} />
      </Box>
    ),
  },
  {
    title: 'край диапазона — 0',
    node: (
      <Box>
        <VolumeSlider label="vol" value={0} />
      </Box>
    ),
  },
  {
    title: 'край диапазона — 100',
    node: (
      <Box>
        <VolumeSlider label="vol" value={100} />
      </Box>
    ),
  },
  {
    title: 'disabled',
    node: (
      <Box>
        <VolumeSlider label="vol" value={20} disabled />
      </Box>
    ),
  },
  {
    title: 'на тёмном',
    dark: true,
    node: (
      <Box>
        <VolumeSlider label="vol" value={70} onDark />
      </Box>
    ),
  },
  {
    title: 'disabled · на тёмном',
    dark: true,
    node: (
      <Box>
        <VolumeSlider label="vol" value={20} disabled onDark />
      </Box>
    ),
  },
];
