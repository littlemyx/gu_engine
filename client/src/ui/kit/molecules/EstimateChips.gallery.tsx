import React from 'react';

import EstimateChips from './EstimateChips';

import type { GalleryCase } from '../galleryTypes';

export const title = 'EstimateChips';

export const cases: GalleryCase[] = [
  {
    title: 'охват · часть включена',
    node: (
      <EstimateChips
        items={[
          { label: 'проза', selected: true },
          { label: 'медиа', price: '+≈$2.10', selected: false },
        ]}
        onToggle={() => {}}
      />
    ),
  },
  {
    title: 'всё включено',
    node: (
      <EstimateChips
        items={[
          { label: 'проза', selected: true },
          { label: 'медиа', price: '+≈$2.10', selected: true },
          { label: 'озвучка', price: '+≈$0.60', selected: true },
        ]}
        onToggle={() => {}}
      />
    ),
  },
  {
    title: 'ничего не включено',
    node: (
      <EstimateChips
        items={[
          { label: 'проза', selected: false },
          { label: 'медиа', price: '+≈$2.10', selected: false },
        ]}
        onToggle={() => {}}
      />
    ),
  },
  {
    title: 'без колбэка · не кликабельно',
    node: (
      <EstimateChips
        items={[
          { label: 'проза', selected: true },
          { label: 'медиа', price: '+≈$2.10', selected: false },
        ]}
      />
    ),
  },
  {
    title: 'на тёмном',
    node: (
      <EstimateChips
        items={[
          { label: 'проза', selected: true },
          { label: 'медиа', price: '+≈$2.10', selected: false },
        ]}
        onToggle={() => {}}
        onDark
      />
    ),
    dark: true,
  },
];
