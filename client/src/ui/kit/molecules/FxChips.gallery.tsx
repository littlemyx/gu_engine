import React from 'react';

import FxChips from './FxChips';

import type { GalleryCase } from '../galleryTypes';

export const title = 'FxChips';

const ITEMS = [{ text: 'reverb 18%' }, { text: 'lowpass 4k' }, { text: 'fade-in 1.2s' }];

export const cases: GalleryCase[] = [
  {
    title: 'обычные фишки',
    node: <FxChips items={ITEMS} onAdd={() => {}} />,
  },
  {
    title: 'removable · с крестиком снятия',
    node: <FxChips items={ITEMS} removable onAdd={() => {}} onRemove={() => {}} />,
  },
  {
    title: 'своя подпись кнопки добавления',
    node: <FxChips items={ITEMS} addLabel="+ обработка" onAdd={() => {}} />,
  },
  {
    title: 'без onAdd · кнопка не кликабельна',
    node: <FxChips items={ITEMS} removable onRemove={() => {}} />,
  },
  {
    title: 'на тёмном',
    node: <FxChips items={ITEMS} removable onDark onAdd={() => {}} onRemove={() => {}} />,
    dark: true,
  },
];
