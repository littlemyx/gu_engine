import React from 'react';

import TakeChips from './TakeChips';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TakeChips';

export const cases: GalleryCase[] = [
  {
    title: 'обычный',
    node: <TakeChips items={[{ label: '№1', count: '9' }]} onPick={() => {}} />,
  },
  {
    title: 'сравниваемый',
    node: <TakeChips items={[{ label: '№2', count: '12', status: 'compared' }]} onPick={() => {}} />,
  },
  {
    title: 'принят',
    node: <TakeChips items={[{ label: '№3', status: 'accepted' }]} onPick={() => {}} />,
  },
  {
    title: 'ряд тейков',
    node: (
      <TakeChips
        items={[
          { label: '№1', count: '9' },
          { label: '№2', count: '12', status: 'compared' },
          { label: '№3', status: 'accepted' },
        ]}
        onPick={() => {}}
      />
    ),
  },
  {
    title: 'без колбэка · не кликабельно',
    node: (
      <TakeChips
        items={[
          { label: '№1', count: '9' },
          { label: '№2', count: '12', status: 'compared' },
          { label: '№3', status: 'accepted' },
        ]}
      />
    ),
  },
  {
    title: 'на тёмном',
    node: (
      <TakeChips
        items={[
          { label: '№1', count: '9' },
          { label: '№2', count: '12', status: 'compared' },
          { label: '№3', status: 'accepted' },
        ]}
        onPick={() => {}}
        onDark
      />
    ),
    dark: true,
  },
];
