import React from 'react';

import CastingBadge from './CastingBadge';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CastingBadge';

export const cases: GalleryCase[] = [
  { title: 'руками', node: <CastingBadge kind="руками" /> },
  { title: 'префаб', node: <CastingBadge kind="префаб" /> },
  { title: 'сгенерировать', node: <CastingBadge kind="сгенерировать" /> },
  { title: 'кастомная подпись', node: <CastingBadge kind="префаб" label="Ирис v3" /> },
  { title: 'кликабельный (кнопка)', node: <CastingBadge kind="префаб" onClick={() => {}} /> },
  { title: 'руками · на тёмном', dark: true, node: <CastingBadge kind="руками" onDark /> },
  { title: 'префаб · на тёмном', dark: true, node: <CastingBadge kind="префаб" onDark /> },
  { title: 'сгенерировать · на тёмном', dark: true, node: <CastingBadge kind="сгенерировать" onDark /> },
  {
    title: 'кликабельный · на тёмном',
    dark: true,
    node: <CastingBadge kind="префаб" onClick={() => {}} onDark />,
  },
];
