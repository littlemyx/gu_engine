import React from 'react';

import FileRow from './FileRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'FileRow';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · без действия',
    node: <FileRow fileName="sample-brief.json" meta="3.5 КБ · version 0.1 ✓ схема валидна" />,
  },
  {
    title: 'с действием «заменить…»',
    node: <FileRow fileName="sample-brief.json" meta="3.5 КБ · version 0.1 ✓ схема валидна" onAction={() => {}} />,
  },
  {
    title: 'узкая строка (300px) · длинная мета обрезается',
    node: (
      <FileRow
        fileName="world-calendar.json"
        meta="128 КБ · version 2.3 ✕ схема не прошла валидацию, есть незакрытые ссылки"
        width={300}
        onAction={() => {}}
      />
    ),
  },
  {
    title: 'своя подпись действия',
    node: (
      <FileRow
        fileName="cast-plan.json"
        meta="9.1 КБ · version 1.0 ✓ схема валидна"
        actionLabel="удалить"
        onAction={() => {}}
      />
    ),
  },
];
