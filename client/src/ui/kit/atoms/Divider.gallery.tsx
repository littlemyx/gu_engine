import React from 'react';

import Divider from './Divider';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Divider';

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{children}</div>
);

export const cases: GalleryCase[] = [
  {
    title: 'верт. · на тёмном',
    dark: true,
    node: (
      <Row>
        <span style={{ color: 'var(--gu-ink-75)' }}>слева</span>
        <Divider orientation="vertical" length={18} />
        <span style={{ color: 'var(--gu-ink-75)' }}>справа</span>
      </Row>
    ),
  },
  {
    title: 'верт. тихий · на тёмном',
    dark: true,
    node: (
      <Row>
        <span style={{ color: 'var(--gu-ink-75)' }}>слева</span>
        <Divider orientation="vertical" length={18} quiet />
        <span style={{ color: 'var(--gu-ink-75)' }}>справа</span>
      </Row>
    ),
  },
  {
    title: 'гориз. · на тёмном',
    dark: true,
    node: <Divider orientation="horizontal" length={120} />,
  },
  {
    title: 'верт. · на светлом',
    node: (
      <Row>
        <span>слева</span>
        <Divider orientation="vertical" length={18} onDark={false} />
        <span>справа</span>
      </Row>
    ),
  },
  {
    title: 'верт. тихий · на светлом',
    node: (
      <Row>
        <span>слева</span>
        <Divider orientation="vertical" length={18} quiet onDark={false} />
        <span>справа</span>
      </Row>
    ),
  },
  {
    title: 'гориз. · на светлом',
    node: <Divider orientation="horizontal" length={120} onDark={false} />,
  },
];
