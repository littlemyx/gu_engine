import React from 'react';

import PrefabCard from './PrefabCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PrefabCard';

const BASE = {
  glyph: '◐',
  title: 'Кира v3',
  kind: 'персонаж',
  src: 'обновлена 25 июля',
};

export const cases: GalleryCase[] = [
  {
    title: 'тон ok',
    dark: true,
    node: <PrefabCard {...BASE} tone="ok" status="закастована v3" onClick={() => {}} />,
  },
  {
    title: 'тон wait',
    dark: true,
    node: <PrefabCard {...BASE} tone="wait" status="кастинг не запущен" onClick={() => {}} />,
  },
  {
    title: 'тон bad',
    dark: true,
    node: <PrefabCard {...BASE} tone="bad" status="закастована v2 → есть v3" onClick={() => {}} />,
  },
  {
    title: 'тон muted',
    dark: true,
    node: <PrefabCard {...BASE} tone="muted" status="архивный префаб" onClick={() => {}} />,
  },
  {
    title: 'selected',
    dark: true,
    node: <PrefabCard {...BASE} tone="ok" status="закастована v3" selected onClick={() => {}} />,
  },
  {
    title: 'dragging',
    dark: true,
    node: <PrefabCard {...BASE} tone="ok" status="закастована v3" dragging onClick={() => {}} />,
  },
  {
    title: 'без onClick (нейнтерактивная)',
    dark: true,
    node: <PrefabCard {...BASE} tone="wait" status="кастинг не запущен" />,
  },
];
