import React from 'react';

import Shadow from './Shadow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Shadow';

const Card = () => (
  <div
    style={{
      width: 132,
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gu-paper)',
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      color: 'var(--color-text)',
    }}
  >
    карточка
  </div>
);

export const cases: GalleryCase[] = [
  { title: 'sm', node: <Shadow size="sm" /> },
  { title: 'md', node: <Shadow size="md" /> },
  { title: 'lg', node: <Shadow size="lg" /> },
  {
    title: 'md · с содержимым',
    node: (
      <Shadow size="md">
        <Card />
      </Shadow>
    ),
  },
];
