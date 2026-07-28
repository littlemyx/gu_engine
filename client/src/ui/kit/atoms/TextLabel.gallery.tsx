import React from 'react';

import TextLabel from './TextLabel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TextLabel';

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <TextLabel text="Метка интерфейса" /> },
  { title: 'bold', node: <TextLabel text="Метка интерфейса" bold /> },
  { title: 'на тёмном', dark: true, node: <TextLabel text="Метка интерфейса" onDark /> },
  { title: 'на тёмном · bold', dark: true, node: <TextLabel text="Метка интерфейса" onDark bold /> },
];
