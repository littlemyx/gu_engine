import React from 'react';

import ChecklistRow from './ChecklistRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ChecklistRow';

export const cases: GalleryCase[] = [
  {
    title: 'ready · готово · на тёмном',
    dark: true,
    node: <ChecklistRow title="мир" meta="университет · bittersweet · 3 темы" state="ready" />,
  },
  {
    title: 'warning · предупреждение · на тёмном',
    dark: true,
    node: <ChecklistRow title="спайн" meta="есть неразрешённые ветки" state="warning" />,
  },
  {
    title: 'problem · проблема · на тёмном',
    dark: true,
    node: <ChecklistRow title="каст-план" meta="персонаж без портрета" state="problem" />,
  },
  {
    title: 'pending · ожидает · на тёмном',
    dark: true,
    node: <ChecklistRow title="аудио-набор" meta="не создано" state="pending" />,
  },
  {
    title: 'ready · готово · на светлом',
    node: <ChecklistRow title="мир" meta="университет · bittersweet · 3 темы" state="ready" onDark={false} />,
  },
  {
    title: 'warning · предупреждение · на светлом',
    node: <ChecklistRow title="спайн" meta="есть неразрешённые ветки" state="warning" onDark={false} />,
  },
  {
    title: 'problem · проблема · на светлом',
    node: <ChecklistRow title="каст-план" meta="персонаж без портрета" state="problem" onDark={false} />,
  },
  {
    title: 'pending · ожидает · на светлом',
    node: <ChecklistRow title="аудио-набор" meta="не создано" state="pending" onDark={false} />,
  },
];
