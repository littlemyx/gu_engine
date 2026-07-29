import React from 'react';

import RelationMeter from './RelationMeter';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RelationMeter';

export const cases: GalleryCase[] = [
  { title: 'рост, на светлом', node: <RelationMeter name="Кира" value={62} trend="рост" /> },
  { title: 'спад, на светлом', node: <RelationMeter name="Ортега" value={28} trend="спад" /> },
  { title: 'без тренда, на светлом', node: <RelationMeter name="Лин" value={50} trend="нет" /> },
  { title: 'рост, на тёмном', node: <RelationMeter name="Кира" value={62} trend="рост" onDark />, dark: true },
  { title: 'спад, на тёмном', node: <RelationMeter name="Ортега" value={28} trend="спад" onDark />, dark: true },
  {
    title: 'без тренда, на тёмном',
    node: <RelationMeter name="Лин" value={50} trend="нет" onDark />,
    dark: true,
  },
  { title: 'край диапазона — 0', node: <RelationMeter name="Дэш" value={0} trend="спад" /> },
  { title: 'край диапазона — 100', node: <RelationMeter name="Дэш" value={100} trend="рост" /> },
  {
    title: 'длинное имя обрезается',
    node: <RelationMeter name="Александра-Виктория" value={44} trend="нет" />,
  },
];
