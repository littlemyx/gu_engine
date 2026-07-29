import React from 'react';

import StrictModeToggle from './StrictModeToggle';

import type { GalleryCase } from '../galleryTypes';

export const title = 'StrictModeToggle';

export const cases: GalleryCase[] = [
  { title: 'выключен', dark: true, node: <StrictModeToggle onChange={() => {}} /> },
  { title: 'включён', dark: true, node: <StrictModeToggle checked onChange={() => {}} /> },
  { title: 'disabled · выключен', dark: true, node: <StrictModeToggle disabled onChange={() => {}} /> },
  { title: 'disabled · включён', dark: true, node: <StrictModeToggle checked disabled onChange={() => {}} /> },
  { title: 'без колбэка (только чтение)', dark: true, node: <StrictModeToggle checked /> },
];
