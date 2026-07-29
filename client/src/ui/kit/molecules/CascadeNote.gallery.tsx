import React from 'react';

import CascadeNote from './CascadeNote';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CascadeNote';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом, только пояснение',
    node: <CascadeNote note="смена принятого протухнет потомков — покажем перед применением" />,
  },
  {
    title: 'на светлом, с меткой справа',
    node: (
      <CascadeNote
        note="смена принятого протухнет потомков — покажем перед применением"
        right="храним последние 5 · старшие уходят в GC"
      />
    ),
  },
  {
    title: 'на тёмном, с меткой справа',
    dark: true,
    node: (
      <CascadeNote
        note="смена принятого протухнет потомков — покажем перед применением"
        right="храним последние 5 · старшие уходят в GC"
        onDark
      />
    ),
  },
  {
    title: 'узкая ширина, fill',
    node: (
      <CascadeNote
        note="откат ветки сотрёт черновики после точки расхождения"
        right="20 версий на ветку"
        width="fill"
      />
    ),
  },
];
