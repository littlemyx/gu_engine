import React from 'react';

import CriticVerdict from './CriticVerdict';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CriticVerdict';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: <CriticVerdict title="попытка 2 · критик отверг №1:" quote="обращение на вы — брифу противоречит" />,
  },
  {
    title: 'на тёмном',
    node: <CriticVerdict title="попытка 2 · критик отверг №1:" quote="обращение на вы — брифу противоречит" onDark />,
    dark: true,
  },
];
