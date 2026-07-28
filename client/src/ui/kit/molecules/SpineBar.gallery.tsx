import React from 'react';

import SpineBar from './SpineBar';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SpineBar';

export const cases: GalleryCase[] = [
  { title: 'заливка', node: <SpineBar label="Б2" state="fill" /> },
  { title: 'окно', node: <SpineBar label="Б2" state="window" note="окно Д1в–Д2в" fillStart={0} fillWidth={25} /> },
  { title: 'штриховка', node: <SpineBar label="Б5а ✓ · Б5б ▨" state="hatch" /> },
  { title: 'якорь', node: <SpineBar label="Б4" state="anchor" /> },
  { title: 'финал', node: <SpineBar label="Б9" state="final" /> },
  {
    title: 'выбрано',
    node: <SpineBar label="Б2" state="window" note="окно Д1в–Д2в" selected />,
  },
  {
    title: 'кликабельная',
    node: <SpineBar label="Б2" state="fill" onClick={() => {}} />,
  },
];
