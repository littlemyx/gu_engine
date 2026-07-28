import React from 'react';

import FloatingDock, { type FloatingDockItem } from './FloatingDock';

import type { GalleryCase } from '../galleryTypes';

export const title = 'FloatingDock';

const ITEMS: FloatingDockItem[] = [
  { glyph: '≡', label: 'Иерархия' },
  { glyph: '▤', label: 'Ассеты', notify: true },
  { glyph: '≣', label: 'Лог' },
];

export const cases: GalleryCase[] = [
  {
    title: 'первая вкладка активна',
    dark: true,
    node: <FloatingDock items={ITEMS} onSelect={() => {}} />,
  },
  {
    title: 'активна вкладка с notify',
    dark: true,
    node: <FloatingDock items={ITEMS} activeIndex={1} onSelect={() => {}} />,
  },
  {
    title: 'активна последняя вкладка',
    dark: true,
    node: <FloatingDock items={ITEMS} activeIndex={2} onSelect={() => {}} />,
  },
  {
    title: 'без onSelect — неинтерактивный док',
    dark: true,
    node: <FloatingDock items={ITEMS} activeIndex={0} />,
  },
];
