import React from 'react';

import BottomTabs from './BottomTabs';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BottomTabs';

const TABS = [{ label: 'Пайплайн' }, { label: 'Лента' }, { label: 'Прогоны' }];

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · первая вкладка активна',
    dark: true,
    node: <BottomTabs tabs={TABS} onPick={() => {}} />,
  },
  {
    title: 'активна другая вкладка',
    dark: true,
    node: <BottomTabs tabs={TABS} active={2} onPick={() => {}} />,
  },
  {
    title: 'свёрнуто',
    dark: true,
    node: <BottomTabs tabs={TABS} active={1} collapsed onPick={() => {}} />,
  },
  {
    title: 'без onPick — вкладки не кликабельны',
    dark: true,
    node: <BottomTabs tabs={TABS} active={0} />,
  },
];
