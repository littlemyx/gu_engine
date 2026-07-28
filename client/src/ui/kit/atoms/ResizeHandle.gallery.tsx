import React from 'react';

import ResizeHandle from './ResizeHandle';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ResizeHandle';

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      color: 'var(--color-neutral-500)',
    }}
  >
    {children}
  </div>
);

const VerticalBox = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      width: 260,
      height: 120,
      border: '1px solid var(--color-neutral-300)',
    }}
  >
    <Panel>панель A</Panel>
    {children}
    <Panel>панель B</Panel>
  </div>
);

const HorizontalBox = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      width: 220,
      height: 160,
      border: '1px solid var(--color-neutral-300)',
    }}
  >
    <Panel>панель A</Panel>
    {children}
    <Panel>панель B</Panel>
  </div>
);

export const cases: GalleryCase[] = [
  {
    title: 'вертикальная (по умолчанию)',
    node: (
      <VerticalBox>
        <ResizeHandle orientation="vertical" split={50} />
      </VerticalBox>
    ),
  },
  {
    title: 'вертикальная · сдвинутая',
    node: (
      <VerticalBox>
        <ResizeHandle orientation="vertical" split={70} />
      </VerticalBox>
    ),
  },
  {
    title: 'горизонтальная',
    node: (
      <HorizontalBox>
        <ResizeHandle orientation="horizontal" split={35} />
      </HorizontalBox>
    ),
  },
];
