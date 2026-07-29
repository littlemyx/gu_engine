import React from 'react';

import PriceTag from './PriceTag';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PriceTag';

export const cases: GalleryCase[] = [
  { title: 'в кнопке', node: <PriceTag value="≈$0.02" variant="button" /> },
  { title: 'отдельно', node: <PriceTag value="≈$0.02" variant="standalone" /> },
  { title: 'итог', node: <PriceTag value="≈$3.46" variant="total" /> },
  { title: 'в кнопке · на тёмном', dark: true, node: <PriceTag value="≈$0.02" variant="button" onDark /> },
  { title: 'отдельно · на тёмном', dark: true, node: <PriceTag value="≈$0.02" variant="standalone" onDark /> },
  { title: 'итог · на тёмном', dark: true, node: <PriceTag value="≈$3.46" variant="total" onDark /> },
  { title: 'тон · акцент', node: <PriceTag value="≈$0.02" variant="total" tone="accent" /> },
  { title: 'тон · приглушённый', node: <PriceTag value="≈$0.02" variant="total" tone="muted" /> },
  { title: 'тон · ошибка', node: <PriceTag value="≈$0.02" variant="total" tone="error" /> },
  {
    title: 'тон · акцент · на тёмном',
    dark: true,
    node: <PriceTag value="≈$0.02" variant="total" tone="accent" onDark />,
  },
  {
    title: 'тон · приглушённый · на тёмном',
    dark: true,
    node: <PriceTag value="≈$0.02" variant="total" tone="muted" onDark />,
  },
  {
    title: 'тон · ошибка · на тёмном',
    dark: true,
    node: <PriceTag value="≈$0.02" variant="total" tone="error" onDark />,
  },
  { title: 'гарнитура · основной шрифт', node: <PriceTag value="≈$3.46" variant="total" fontFamily="body" /> },
  {
    title: 'гарнитура · основной шрифт · в кнопке',
    node: <PriceTag value="≈$0.02" variant="button" fontFamily="body" />,
  },
];
