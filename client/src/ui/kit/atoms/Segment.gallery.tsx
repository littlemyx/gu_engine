import React from 'react';

import Segment from './Segment';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Segment';

export const cases: GalleryCase[] = [
  { title: 'залитая active', node: <Segment label="Сцены" selected onClick={() => {}} /> },
  { title: 'контурная', node: <Segment label="Партитура" onClick={() => {}} /> },
  { title: 'disabled «скоро»', node: <Segment label="Карта мира" disabled onClick={() => {}} /> },
  { title: 'без колбэка', node: <Segment label="Сценарий" /> },
  {
    title: 'залитая active · на тёмном',
    dark: true,
    node: <Segment label="Сцены" selected onDark onClick={() => {}} />,
  },
  { title: 'контурная · на тёмном', dark: true, node: <Segment label="Партитура" onDark onClick={() => {}} /> },
  {
    title: 'disabled «скоро» · на тёмном',
    dark: true,
    node: <Segment label="Карта мира" disabled onDark onClick={() => {}} />,
  },
];
