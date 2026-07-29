import React from 'react';

import FxParam from './FxParam';

import type { GalleryCase } from '../galleryTypes';

export const title = 'FxParam';

const Box = ({ children }: { children: React.ReactNode }) => <div style={{ width: 220 }}>{children}</div>;

export const cases: GalleryCase[] = [
  {
    title: 'значение по умолчанию',
    dark: true,
    node: (
      <Box>
        <FxParam label="реверб" />
      </Box>
    ),
  },
  {
    title: 'малое значение',
    dark: true,
    node: (
      <Box>
        <FxParam label="дилэй" value={4} />
      </Box>
    ),
  },
  {
    title: 'высокое значение',
    dark: true,
    node: (
      <Box>
        <FxParam label="хорус" value={82} />
      </Box>
    ),
  },
  {
    title: 'disabled',
    dark: true,
    node: (
      <Box>
        <FxParam label="флэнджер" value={30} disabled />
      </Box>
    ),
  },
];
