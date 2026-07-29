import React from 'react';

import RunParams from './RunParams';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RunParams';

export const cases: GalleryCase[] = [
  {
    title: 'колонка · цена и раскрывающийся пункт',
    node: (
      <RunParams
        rows={[
          { text: 'ретраи: до 2 попыток/позиция', price: '≈$0.31' },
          { text: 'пауза: после каждой порции', expandable: true },
        ]}
        onPick={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
  {
    title: 'строка (direction="row")',
    node: (
      <RunParams
        direction="row"
        rows={[
          { text: 'ретраи: до 2 попыток/позиция' },
          { text: 'бюджет ≈$0.31' },
          { text: 'пауза: после каждой порции', expandable: true },
        ]}
        onPick={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
  {
    title: 'без onPick — раскрывающийся пункт немой',
    node: (
      <RunParams
        rows={[
          { text: 'ретраи: до 2 попыток/позиция', price: '≈$0.31' },
          { text: 'пауза: после каждой порции', expandable: true },
        ]}
      />
    ),
  },
  {
    title: 'только статичные пункты',
    node: (
      <RunParams
        rows={[{ text: 'модель: gpt-4.1-mini' }, { text: 'параллелизм: 3 позиции' }, { text: 'бюджет ≈$0.31' }]}
      />
    ),
  },
];
