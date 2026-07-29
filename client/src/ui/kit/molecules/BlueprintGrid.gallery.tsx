import React from 'react';

import BlueprintGrid from './BlueprintGrid';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BlueprintGrid';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · зум-лейбл считается из zoom/step',
    node: <BlueprintGrid />,
  },
  {
    title: 'крупный шаг сетки и другой зум',
    node: <BlueprintGrid step={40} zoom={200} />,
  },
  {
    title: 'мелкий шаг сетки',
    node: <BlueprintGrid step={10} zoom={50} />,
  },
  {
    title: 'явный лейбл вместо вычисленного',
    node: <BlueprintGrid label="привязано к сетке" />,
  },
  {
    title: 'без лейбла',
    node: <BlueprintGrid label="" />,
  },
  {
    title: 'с содержимым поверх сетки',
    node: (
      <BlueprintGrid>
        <span style={{ fontSize: 12, color: 'var(--color-text)' }}>кадр вьюпорта</span>
      </BlueprintGrid>
    ),
  },
];
