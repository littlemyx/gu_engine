import React from 'react';

import DropTargetSlot from './DropTargetSlot';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DropTargetSlot';

const LABEL = 'слот Д6у · свободен — отпустить сюда';

export const cases: GalleryCase[] = [
  {
    title: 'активен, на светлом',
    node: <DropTargetSlot label={LABEL} active />,
  },
  {
    title: 'активен, на тёмном',
    dark: true,
    node: <DropTargetSlot label={LABEL} active onDark />,
  },
  {
    title: 'занят, на светлом',
    node: <DropTargetSlot label="слот Д6у · занят — сцена «Явка»" busy />,
  },
  {
    title: 'занят, на тёмном',
    dark: true,
    node: <DropTargetSlot label="слот Д6у · занят — сцена «Явка»" busy onDark />,
  },
  {
    title: 'неактивен, на светлом',
    node: <DropTargetSlot label="слот Д6у · вне оборота" active={false} />,
  },
  {
    title: 'неактивен, на тёмном',
    dark: true,
    node: <DropTargetSlot label="слот Д6у · вне оборота" active={false} onDark />,
  },
  {
    title: 'фиксированная ширина 220px',
    dark: true,
    node: <DropTargetSlot label="слот" active onDark width={220} />,
  },
];
