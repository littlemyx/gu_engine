import React from 'react';

import MonoText from './MonoText';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MonoText';

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <MonoText text="seed:8f4a·v3" /> },
  { title: 'muted', node: <MonoText text="seed:8f4a·v3" muted /> },
  { title: 'подсветка-фон', node: <MonoText text="seed:8f4a·v3" highlight /> },
  { title: '9px', node: <MonoText text="seed:8f4a·v3" size={9} /> },
  { title: '11px', node: <MonoText text="seed:8f4a·v3" size={11} /> },
  { title: 'на тёмном', dark: true, node: <MonoText text="seed:8f4a·v3" onDark /> },
  { title: 'на тёмном · muted', dark: true, node: <MonoText text="seed:8f4a·v3" onDark muted /> },
  { title: 'на тёмном · подсветка-фон', dark: true, node: <MonoText text="seed:8f4a·v3" onDark highlight /> },
];
