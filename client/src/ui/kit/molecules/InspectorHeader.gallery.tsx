import React from 'react';

import InspectorHeader from './InspectorHeader';

import type { GalleryCase } from '../galleryTypes';

export const title = 'InspectorHeader';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <InspectorHeader kicker="ИНСПЕКТОР · beat_prose / b5" title="Проза бита Б5 «Ссора»" />,
  },
  {
    title: 'на тёмном',
    dark: true,
    node: <InspectorHeader kicker="ИНСПЕКТОР · beat_prose / b5" title="Проза бита Б5 «Ссора»" onDark />,
  },
];
