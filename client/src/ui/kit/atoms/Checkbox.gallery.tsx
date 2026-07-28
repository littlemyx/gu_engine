import React from 'react';

import Checkbox from './Checkbox';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Checkbox';

const noop = () => {};

export const cases: GalleryCase[] = [
  { title: 'unchecked', node: <Checkbox label="автосохранение" checked={false} onChange={noop} /> },
  { title: 'checked', node: <Checkbox label="автосохранение" checked onChange={noop} /> },
  { title: 'disabled-dashed', node: <Checkbox label="автосохранение" checked disabled onChange={noop} /> },
  {
    title: 'disabled-dashed · unchecked',
    node: <Checkbox label="автосохранение" checked={false} disabled onChange={noop} />,
  },
  { title: 'без подписи', node: <Checkbox label="автосохранение" checked showLabel={false} onChange={noop} /> },
  { title: 'без onChange · неинтерактивный', node: <Checkbox label="автосохранение" checked /> },
  {
    title: 'unchecked · на тёмном',
    dark: true,
    node: <Checkbox label="автосохранение" checked={false} onDark onChange={noop} />,
  },
  {
    title: 'checked · на тёмном',
    dark: true,
    node: <Checkbox label="автосохранение" checked onDark onChange={noop} />,
  },
  {
    title: 'disabled-dashed · на тёмном',
    dark: true,
    node: <Checkbox label="автосохранение" checked disabled onDark onChange={noop} />,
  },
];
