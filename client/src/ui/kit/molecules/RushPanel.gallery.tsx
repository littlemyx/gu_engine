import React from 'react';

import RushPanel from './RushPanel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RushPanel';

export const cases: GalleryCase[] = [
  {
    title: 'стрим идёт',
    node: <RushPanel speaker="Кира" text="Ты всё-таки пришёл. Я думала, шторм тебя напугал." />,
    dark: true,
  },
  {
    title: 'реплика завершена',
    node: <RushPanel speaker="Кира" text="Ты всё-таки пришёл. Я думала, шторм тебя напугал." streaming={false} />,
    dark: true,
  },
  {
    title: 'другой спикер, короткая реплика',
    node: <RushPanel speaker="Матвей" text="Не напугал." streaming />,
    dark: true,
  },
];
