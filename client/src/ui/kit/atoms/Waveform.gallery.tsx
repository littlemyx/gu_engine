import React from 'react';

import Waveform from './Waveform';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Waveform';

const Track = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      width: 220,
      height: 44,
      background: 'var(--color-bg)',
      border: '1px solid var(--gu-hairline-edge)',
    }}
  >
    {children}
  </div>
);

export const cases: GalleryCase[] = [
  {
    title: 'активная',
    node: (
      <Track>
        <Waveform variant="active" />
      </Track>
    ),
  },
  {
    title: 'приглушённая',
    node: (
      <Track>
        <Waveform variant="muted" />
      </Track>
    ),
  },
  {
    title: 'активная, на тёмном',
    dark: true,
    node: (
      <Track>
        <Waveform variant="active" />
      </Track>
    ),
  },
  {
    title: 'приглушённая, на тёмном',
    dark: true,
    node: (
      <Track>
        <Waveform variant="muted" />
      </Track>
    ),
  },
];
