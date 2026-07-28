import React from 'react';

import CornerMarks from './CornerMarks';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CornerMarks';

const Box = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: '14px 18px', fontSize: 11, fontFamily: 'var(--font-body)' }}>{children}</div>
);

export const cases: GalleryCase[] = [
  {
    title: 'plain',
    node: (
      <CornerMarks>
        <Box>объект</Box>
      </CornerMarks>
    ),
  },
  {
    title: 'accent',
    node: (
      <CornerMarks tone="accent">
        <Box>объект</Box>
      </CornerMarks>
    ),
  },
  {
    title: 'plain · на тёмном',
    dark: true,
    node: (
      <CornerMarks onDark>
        <Box>
          <span style={{ color: 'var(--gu-ink-85)' }}>объект</span>
        </Box>
      </CornerMarks>
    ),
  },
  {
    title: 'accent · на тёмном',
    dark: true,
    node: (
      <CornerMarks tone="accent" onDark>
        <Box>
          <span style={{ color: 'var(--gu-ink-85)' }}>объект</span>
        </Box>
      </CornerMarks>
    ),
  },
];
