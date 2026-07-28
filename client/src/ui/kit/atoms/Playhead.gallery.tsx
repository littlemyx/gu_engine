import React from 'react';

import Playhead from './Playhead';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Playhead';

const Track = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      width: 200,
      height: 48,
      background: 'var(--gu-chrome-deep)',
      border: '1px solid var(--gu-hairline-edge)',
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

export const cases: GalleryCase[] = [
  {
    title: 'accent',
    dark: true,
    node: (
      <Track>
        <Playhead tone="accent" />
      </Track>
    ),
  },
  {
    title: 'contrast',
    dark: true,
    node: (
      <Track>
        <Playhead tone="contrast" />
      </Track>
    ),
  },
  {
    title: 'без флажка (withHandle=false)',
    dark: true,
    node: (
      <Track>
        <Playhead withHandle={false} />
      </Track>
    ),
  },
  {
    title: 'у левого края (position=0)',
    dark: true,
    node: (
      <Track>
        <Playhead position={0} />
      </Track>
    ),
  },
  {
    title: 'у правого края (position=100)',
    dark: true,
    node: (
      <Track>
        <Playhead position={100} />
      </Track>
    ),
  },
  {
    title: 'низкая риска (height=16)',
    dark: true,
    node: (
      <Track>
        <Playhead height={16} />
      </Track>
    ),
  },
];
