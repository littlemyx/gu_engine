import React from 'react';

import FlagsSeed, { type FlagsSeedFlag } from './FlagsSeed';

import type { GalleryCase } from '../galleryTypes';

export const title = 'FlagsSeed';

const FLAGS: FlagsSeedFlag[] = [
  { id: 'storm_seen', active: true },
  { id: 'kira_secret', active: false },
];

const MANY_FLAGS: FlagsSeedFlag[] = [
  { id: 'storm_seen', active: true },
  { id: 'kira_secret', active: false },
  { id: 'met_kira', active: true },
];

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <FlagsSeed flags={FLAGS} seedLabel="seed 12345 · снапшот на каждой смене сцены" />,
  },
  {
    title: 'без флагов',
    node: <FlagsSeed flags={[]} seedLabel="seed 12345 · снапшот на каждой смене сцены" />,
  },
  {
    title: 'свой заголовок флагов',
    node: <FlagsSeed flagsLabel="метки:" flags={FLAGS} seedLabel="seed 12345" />,
  },
  {
    title: 'на тёмном',
    dark: true,
    node: <FlagsSeed flags={FLAGS} seedLabel="seed 12345 · снапшот на каждой смене сцены" onDark />,
  },
  {
    title: 'на тёмном · много флагов',
    dark: true,
    node: <FlagsSeed flags={MANY_FLAGS} seedLabel="seed 90210 · ветка storm-branch" onDark />,
  },
];
