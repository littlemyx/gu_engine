import React from 'react';

import Frame from './Frame';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Frame';

const Content = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 11, fontFamily: 'var(--font-body)' }}>{children}</span>
);

export const cases: GalleryCase[] = [
  {
    title: 'светлая',
    node: (
      <Frame tone="light">
        <Content>контент рамки</Content>
      </Frame>
    ),
  },
  {
    title: 'тёмная',
    dark: true,
    node: (
      <Frame tone="dark">
        <Content>
          <span style={{ color: 'var(--gu-ink-85)' }}>контент рамки</span>
        </Content>
      </Frame>
    ),
  },
  {
    title: 'accent',
    node: (
      <Frame tone="accent">
        <Content>контент рамки</Content>
      </Frame>
    ),
  },
  {
    title: 'selected',
    node: (
      <Frame tone="light" selected>
        <Content>выбрана</Content>
      </Frame>
    ),
  },
  {
    title: 'не интерактивна',
    node: (
      <Frame tone="light" interactive={false}>
        <Content>без фокуса и hover</Content>
      </Frame>
    ),
  },
];
