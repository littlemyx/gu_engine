import React from 'react';

import SelectValue from './SelectValue';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SelectValue';

export const cases: GalleryCase[] = [
  { title: 'обычное', node: <SelectValue value="спрайт-лист А" onClick={() => {}} /> },
  { title: 'пустой «выбрать»', node: <SelectValue value="спрайт-лист А" empty onClick={() => {}} /> },
  { title: 'changed-рамка', node: <SelectValue value="спрайт-лист Б" changed onClick={() => {}} /> },
  { title: 'hover', node: <SelectValue value="спрайт-лист А" onClick={() => {}} /> },
  { title: 'focus', node: <SelectValue value="спрайт-лист А" onClick={() => {}} /> },
  { title: 'disabled', node: <SelectValue value="спрайт-лист А" disabled onClick={() => {}} /> },
  { title: 'error', node: <SelectValue value="спрайт-лист А" error onClick={() => {}} /> },
  { title: 'обычное · на тёмном', dark: true, node: <SelectValue value="спрайт-лист А" onDark onClick={() => {}} /> },
  {
    title: 'пустой «выбрать» · на тёмном',
    dark: true,
    node: <SelectValue value="спрайт-лист А" empty onDark onClick={() => {}} />,
  },
  {
    title: 'changed-рамка · на тёмном',
    dark: true,
    node: <SelectValue value="спрайт-лист Б" changed onDark onClick={() => {}} />,
  },
  {
    title: 'disabled · на тёмном',
    dark: true,
    node: <SelectValue value="спрайт-лист А" disabled onDark onClick={() => {}} />,
  },
  {
    title: 'error · на тёмном',
    dark: true,
    node: <SelectValue value="спрайт-лист А" error onDark onClick={() => {}} />,
  },
];
