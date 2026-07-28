import React from 'react';

import SelectionHighlight from './SelectionHighlight';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SelectionHighlight';

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>{children}</div>
);

export const cases: GalleryCase[] = [
  {
    title: 'row',
    node: (
      <SelectionHighlight variant="row">
        <Row>выбранная строка</Row>
      </SelectionHighlight>
    ),
  },
  {
    title: 'cell',
    node: (
      <SelectionHighlight variant="cell">
        <Row>выбранная ячейка</Row>
      </SelectionHighlight>
    ),
  },
  {
    title: 'outline',
    node: (
      <SelectionHighlight variant="outline">
        <Row>выбранная строка</Row>
      </SelectionHighlight>
    ),
  },
  {
    title: 'row · на тёмном',
    dark: true,
    node: (
      <SelectionHighlight variant="row" onDark>
        <Row>
          <span style={{ color: 'var(--gu-ink-85)' }}>выбранная строка</span>
        </Row>
      </SelectionHighlight>
    ),
  },
  {
    title: 'cell · на тёмном',
    dark: true,
    node: (
      <SelectionHighlight variant="cell" onDark>
        <Row>
          <span style={{ color: 'var(--gu-ink-85)' }}>выбранная ячейка</span>
        </Row>
      </SelectionHighlight>
    ),
  },
  {
    title: 'outline · на тёмном',
    dark: true,
    node: (
      <SelectionHighlight variant="outline" onDark>
        <Row>
          <span style={{ color: 'var(--gu-ink-85)' }}>выбранная строка</span>
        </Row>
      </SelectionHighlight>
    ),
  },
];
