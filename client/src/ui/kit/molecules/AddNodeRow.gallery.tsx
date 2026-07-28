import React from 'react';

import AddNodeRow from './AddNodeRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'AddNodeRow';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом, некликабельна',
    node: <AddNodeRow />,
  },
  {
    title: 'на тёмном, некликабельна',
    dark: true,
    node: <AddNodeRow onDark />,
  },
  {
    title: 'на тёмном, кликабельна',
    dark: true,
    node: <AddNodeRow onDark onAdd={() => {}} />,
  },
  {
    title: 'с подсказкой',
    dark: true,
    node: <AddNodeRow onDark hint="после «Ссора»" onAdd={() => {}} />,
  },
  {
    title: 'узкая ширина',
    dark: true,
    node: <AddNodeRow onDark width={180} onAdd={() => {}} />,
  },
];
