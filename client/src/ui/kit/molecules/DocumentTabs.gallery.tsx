import React from 'react';

import DocumentTabs from './DocumentTabs';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DocumentTabs';

const TABS = [{ label: 'Чертёж' }, { label: 'Партитура' }, { label: 'Сценарий' }, { label: 'Карта' }];

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · первая вкладка активна',
    node: <DocumentTabs tabs={TABS} onPick={() => {}} />,
  },
  {
    title: 'активна другая вкладка',
    node: <DocumentTabs tabs={TABS} active={2} onPick={() => {}} />,
  },
  {
    title: 'с пояснением у правого края',
    node: <DocumentTabs tabs={TABS} active={0} right="сохранено" onPick={() => {}} />,
  },
  {
    title: 'без onPick — вкладки не кликабельны',
    node: <DocumentTabs tabs={TABS} active={0} />,
  },
];
