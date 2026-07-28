import React from 'react';

import SidebarTabs from './SidebarTabs';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SidebarTabs';

const TABS = [{ label: 'Структура' }, { label: 'Пайплайн' }];
const TABS_NOTIFY = [{ label: 'Структура' }, { label: 'Пайплайн', notify: true }];

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · первая вкладка активна',
    dark: true,
    node: <SidebarTabs tabs={TABS} onPick={() => {}} />,
  },
  {
    title: 'активна другая вкладка',
    dark: true,
    node: <SidebarTabs tabs={TABS} active={1} onPick={() => {}} />,
  },
  {
    title: 'непросмотренное на неактивной вкладке',
    dark: true,
    node: <SidebarTabs tabs={TABS_NOTIFY} active={0} onPick={() => {}} />,
  },
  {
    title: 'без onPick — вкладки не кликабельны',
    dark: true,
    node: <SidebarTabs tabs={TABS} active={0} />,
  },
];
