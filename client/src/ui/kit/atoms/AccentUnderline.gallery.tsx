import React from 'react';

import AccentUnderline from './AccentUnderline';

import type { GalleryCase } from '../galleryTypes';

export const title = 'AccentUnderline';

export const cases: GalleryCase[] = [
  {
    title: 'с подложкой',
    node: <AccentUnderline label="Пайплайн" />,
  },
  {
    title: 'без подложки',
    node: <AccentUnderline label="Пайплайн" withBg={false} />,
  },
  {
    title: 'с подложкой · на тёмном',
    dark: true,
    node: <AccentUnderline label="Пайплайн" onDark />,
  },
  {
    title: 'без подложки · на тёмном',
    dark: true,
    node: <AccentUnderline label="Пайплайн" withBg={false} onDark />,
  },
];
