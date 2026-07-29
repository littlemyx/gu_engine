import React from 'react';

import IssueRoute from './IssueRoute';

import type { GalleryCase } from '../galleryTypes';

export const title = 'IssueRoute';

const DEFAULT_LINES = [
  { text: 'маршрут: qa → зона Проза →' },
  { text: 'dialogue_units / unit_kira_s2_pier' },
  { text: 'фидбек уедет в previousIssues дубля' },
];

const SHORT_LINES = [{ text: 'зона Кастинг → зона Мир' }];

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <IssueRoute lines={DEFAULT_LINES} /> },
  { title: 'на светлом · короткий маршрут', node: <IssueRoute lines={SHORT_LINES} /> },
  { title: 'на тёмном', dark: true, node: <IssueRoute lines={DEFAULT_LINES} onDark /> },
  { title: 'на тёмном · короткий маршрут', dark: true, node: <IssueRoute lines={SHORT_LINES} onDark /> },
];
