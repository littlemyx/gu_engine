import React from 'react';

import PanelSpine from './PanelSpine';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PanelSpine';

export const cases: GalleryCase[] = [
  {
    title: 'левая сторона',
    dark: true,
    node: <PanelSpine title="Иерархия" side="left" onExpand={() => {}} />,
  },
  {
    title: 'правая сторона',
    dark: true,
    node: <PanelSpine title="Инспектор" side="right" onExpand={() => {}} />,
  },
  {
    title: 'непросмотренное',
    dark: true,
    node: <PanelSpine title="Партитура" notify onExpand={() => {}} />,
  },
  {
    title: 'без onExpand — статичный корешок',
    dark: true,
    node: <PanelSpine title="Карта мира" />,
  },
  {
    title: 'высокая панель',
    dark: true,
    node: <PanelSpine title="Сценарий" height={320} onExpand={() => {}} />,
  },
];
