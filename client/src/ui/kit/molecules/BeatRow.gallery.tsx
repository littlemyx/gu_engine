import React from 'react';

import BeatRow from './BeatRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BeatRow';

export const cases: GalleryCase[] = [
  {
    title: 'обычная строка',
    dark: true,
    node: <BeatRow title="Б3 Разговор в кафе" badge="ready" />,
  },
  {
    title: 'выбрана, с действиями',
    dark: true,
    node: <BeatRow title="Б5 Ссора" selected badge="ready" onSelect={() => {}} onAction={() => {}} />,
  },
  {
    title: 'устарела, действие «в ведомость»',
    dark: true,
    node: <BeatRow title="Б5 Ссора" selected stale badge="stale" onSelect={() => {}} onAction={() => {}} />,
  },
  {
    title: 'действия видны без выбора (actions=true)',
    dark: true,
    node: <BeatRow title="Б2 Приход домой" actions badge="ready" onAction={() => {}} />,
  },
  {
    title: 'бейдж «нет прозы»',
    dark: true,
    node: <BeatRow title="Б7 Финал" badge="no-prose" />,
  },
  {
    title: 'бейдж «генерируется»',
    dark: true,
    node: <BeatRow title="Б4 Побег" selected badge="generating" onSelect={() => {}} />,
  },
  {
    title: 'без хэндла драга',
    dark: true,
    node: <BeatRow title="Пролог" drag={false} badge="ready" />,
  },
  {
    title: 'некликабельная строка (без onSelect)',
    dark: true,
    node: <BeatRow title="Б1 Завязка" badge="none" />,
  },
];
