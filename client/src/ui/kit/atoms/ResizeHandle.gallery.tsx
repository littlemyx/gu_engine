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

/**
 * Атом — только полоска: размерами панелей в витрине заведует сама витрина,
 * ровно как в шелле этим занимается механизм рамок.
 */
const VerticalBox = ({ first = 120 }: { first?: number }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      width: 260,
      height: 120,
      border: '1px solid var(--color-neutral-300)',
    }}
  >
    <div style={{ width: first, display: 'flex' }}>
      <Panel>панель A</Panel>
    </div>
    <ResizeHandle orientation="vertical" label="Ширина панели A" valueNow={first} />
    <Panel>панель B</Panel>
  </div>
);

const HorizontalBox = ({ first = 60 }: { first?: number }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      width: 220,
      height: 160,
      border: '1px solid var(--color-neutral-300)',
    }}
  >
    <div style={{ height: first, display: 'flex' }}>
      <Panel>панель A</Panel>
    </div>
    <ResizeHandle orientation="horizontal" label="Высота панели A" valueNow={first} />
    <Panel>панель B</Panel>
  </div>
);

export const cases: GalleryCase[] = [
  { title: 'вертикальная (по умолчанию)', node: <VerticalBox /> },
  { title: 'вертикальная · панель шире', node: <VerticalBox first={180} /> },
  { title: 'горизонтальная', node: <HorizontalBox /> },
];
