import React from 'react';

import RadioCard from './RadioCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RadioCard';

export const cases: GalleryCase[] = [
  {
    title: 'выбрана',
    node: <RadioCard title="Пустой проект" desc="чистый бриф, генерация с нуля" selected onSelect={() => {}} />,
  },
  {
    title: 'не выбрана',
    node: <RadioCard title="Из шаблона" desc="стартовый набор сцен и ролей" selected={false} onSelect={() => {}} />,
  },
  {
    title: 'немой индикатор (без onSelect)',
    node: <RadioCard title="Пустой проект" desc="чистый бриф, генерация с нуля" selected />,
  },
];
