import React from 'react';

import BeforeAfterPair from './BeforeAfterPair';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BeforeAfterPair';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию (400px)',
    node: (
      <BeforeAfterPair
        beforeLabel="было:"
        beforeText="«суше, ироничнее»"
        afterLabel="станет:"
        afterText="«мягче, без иронии»"
      />
    ),
  },
  {
    title: 'узкая (280px)',
    node: (
      <BeforeAfterPair beforeLabel="было:" beforeText="«резче»" afterLabel="станет:" afterText="«ровнее»" width={280} />
    ),
  },
  {
    title: 'широкая (700px)',
    node: (
      <BeforeAfterPair
        beforeLabel="было:"
        beforeText="«герой шутит над потерей»"
        afterLabel="станет:"
        afterText="«герой проживает потерю без иронии»"
        width={700}
      />
    ),
  },
  {
    title: 'на тёмном хроме',
    dark: true,
    node: (
      <BeforeAfterPair
        beforeLabel="было:"
        beforeText="«суше, ироничнее»"
        afterLabel="станет:"
        afterText="«мягче, без иронии»"
      />
    ),
  },
];
