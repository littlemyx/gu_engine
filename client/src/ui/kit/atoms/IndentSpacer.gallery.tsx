import React from 'react';

import IndentSpacer from './IndentSpacer';

import type { GalleryCase } from '../galleryTypes';

export const title = 'IndentSpacer';

/** Спейсер прозрачен, поэтому в галерее подсвечиваем занятое им место. */
const Row = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      fontFamily: 'var(--font-body)',
      background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
    }}
  >
    {children}
  </div>
);

export const cases: GalleryCase[] = [
  {
    title: 'level 0',
    node: (
      <Row>
        <IndentSpacer level={0} />
        <span>корень</span>
      </Row>
    ),
  },
  {
    title: 'level 2 (по умолчанию)',
    node: (
      <Row>
        <IndentSpacer />
        <span>порция 2 · ступень 2</span>
      </Row>
    ),
  },
  {
    title: 'level 4',
    node: (
      <Row>
        <IndentSpacer level={4} />
        <span>реплика Киры</span>
      </Row>
    ),
  },
  {
    title: 'крупный шаг (step 24)',
    node: (
      <Row>
        <IndentSpacer level={3} step={24} />
        <span>step 24px</span>
      </Row>
    ),
  },
];
