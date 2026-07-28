import React from 'react';

import LegendRow from './LegendRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'LegendRow';

export const cases: GalleryCase[] = [
  {
    title: 'легенда чертежа + пояснение',
    node: (
      <LegendRow
        items={[
          { color: 'var(--color-accent-200)', label: 'в локации по расписанию' },
          { color: 'var(--color-accent)', label: 'встреча — диалоговый юнит' },
          { color: 'var(--color-accent-700)', label: 'якорный бит' },
        ]}
        note="21 слот = 7 дней × 3 фазы"
      />
    ),
  },
  {
    title: 'без пояснения',
    node: (
      <LegendRow
        items={[
          { color: 'var(--color-accent-200)', label: 'запланировано' },
          { color: 'var(--color-neutral-400)', label: 'пропущено' },
        ]}
      />
    ),
  },
  {
    title: 'один пункт',
    node: <LegendRow items={[{ color: 'var(--color-accent-900)', label: 'финал ветки' }]} note="1 бит" />,
  },
  {
    title: 'на тёмном хроме',
    dark: true,
    node: (
      <LegendRow
        items={[
          { color: 'var(--color-accent-200)', label: 'в локации по расписанию' },
          { color: 'var(--color-accent-700)', label: 'якорный бит' },
        ]}
        note="21 слот = 7 дней × 3 фазы"
        onDark
      />
    ),
  },
];
