import React from 'react';

import DirectorNote from './DirectorNote';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DirectorNote';

export const cases: GalleryCase[] = [
  {
    title: 'quote · на светлом',
    node: <DirectorNote kind="quote" text="меньше пафоса, без крика" hint="уйдёт в следующий дубль" />,
  },
  {
    title: 'quote · без подсказки',
    node: <DirectorNote kind="quote" text="меньше пафоса, без крика" />,
  },
  {
    title: 'quote · на тёмном',
    dark: true,
    node: <DirectorNote kind="quote" text="меньше пафоса, без крика" hint="уйдёт в следующий дубль" onDark />,
  },
  {
    title: 'add · на светлом',
    node: <DirectorNote kind="add" text="добавить заметку режиссёру" />,
  },
  {
    title: 'add · на тёмном',
    dark: true,
    node: <DirectorNote kind="add" text="добавить заметку режиссёру" onDark />,
  },
  {
    title: 'узкая ширина',
    node: <DirectorNote kind="quote" text="меньше пафоса, без крика" hint="уйдёт в следующий дубль" width={220} />,
  },
];
