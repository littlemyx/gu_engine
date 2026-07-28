import React from 'react';

import Heading from './Heading';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Heading';

export const cases: GalleryCase[] = [
  { title: 'карточный 12–14', node: <Heading text="Заголовок панели" level="card" /> },
  { title: 'модальный 16', node: <Heading text="Заголовок панели" level="modal" /> },
  { title: 'экранный 18–20', node: <Heading text="Заголовок панели" level="screen" /> },
  { title: 'без uppercase', node: <Heading text="Заголовок панели" uppercase={false} /> },
  {
    title: 'на тёмном',
    dark: true,
    node: <Heading text="Заголовок панели" onDark />,
  },
];
