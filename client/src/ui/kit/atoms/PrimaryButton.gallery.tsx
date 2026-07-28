import React from 'react';

import PrimaryButton from './PrimaryButton';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PrimaryButton';

export const cases: GalleryCase[] = [
  { title: 'обычная', node: <PrimaryButton label="Сгенерировать" /> },
  { title: 'со сметой', node: <PrimaryButton label="Продолжить конвейер" price="≈$3.46" /> },
  { title: 'с глифом', node: <PrimaryButton label="Превью" glyph="▶" /> },
  { title: 'компактная', node: <PrimaryButton label="Применить" size="compact" /> },
  { title: 'без реперов', node: <PrimaryButton label="Применить" marks={false} /> },
  { title: 'disabled', node: <PrimaryButton label="Сгенерировать" disabled /> },
  { title: 'loading', node: <PrimaryButton label="Идёт прогон" loading /> },
  { title: 'block', node: <PrimaryButton label="Собрать релиз" block marks={false} /> },
];
