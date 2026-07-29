import React from 'react';

import MapNode from './MapNode';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MapNode';

export const cases: GalleryCase[] = [
  {
    title: 'default',
    node: <MapNode name="Кафе «Прибой»" meta="♪ уютный · фон ✓ · сцен 12" state="default" />,
  },
  {
    title: 'selected',
    node: <MapNode name="Кафе «Прибой»" meta="♪ уютный · фон ✓ · сцен 12" state="selected" />,
  },
  {
    title: 'queued',
    node: <MapNode name="Кафе «Прибой»" meta="♪ винил · фон ⟳ в очереди · сцен 4" state="queued" />,
  },
  {
    title: 'error',
    node: <MapNode name="Кафе «Прибой»" meta="фон ✗ упал · сцен 3" state="error" />,
  },
  {
    title: 'кликабельная (роль button)',
    node: <MapNode name="Кафе «Прибой»" meta="♪ уютный · фон ✓ · сцен 12" state="default" onClick={() => {}} />,
  },
  {
    title: 'узкая ширина (120px)',
    node: <MapNode name="Маяк" meta="сцен 2" state="default" width={120} />,
  },
  {
    title: 'широкая (240px)',
    node: <MapNode name="Заброшенный вокзал" meta="♪ тревожный · фон ✓ · сцен 8" state="selected" width={240} />,
  },
];
