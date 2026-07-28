import React from 'react';

import MutedText from './MutedText';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MutedText';

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <MutedText text="пояснение · мета" /> },
  { title: 'на светлом · тихий', node: <MutedText text="пояснение · мета" quiet /> },
  { title: 'на тёмном', dark: true, node: <MutedText text="пояснение · мета" onDark /> },
  { title: 'на тёмном · тихий', dark: true, node: <MutedText text="пояснение · мета" onDark quiet /> },
  { title: 'крупный кегль (13px)', node: <MutedText text="пояснение · мета" size={13} /> },
];
