import React from 'react';

import CheckerBg from './CheckerBg';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CheckerBg';

export const cases: GalleryCase[] = [
  { title: 'по умолчанию (клетка 14px, в рамке)', node: <CheckerBg /> },
  { title: 'крупная клетка (24px)', node: <CheckerBg cell={24} width={220} height={140} /> },
  { title: 'мелкая клетка (8px)', node: <CheckerBg cell={8} width={160} height={100} /> },
  { title: 'без рамки', node: <CheckerBg framed={false} /> },
  {
    title: 'со своим содержимым',
    node: (
      <CheckerBg width={160} height={100}>
        <span style={{ fontFamily: 'var(--gu-mono)', fontSize: 10, color: 'var(--color-neutral-700)' }}>
          спрайт.png
        </span>
      </CheckerBg>
    ),
  },
];
