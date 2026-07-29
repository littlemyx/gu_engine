import React from 'react';

import IssueQuote from './IssueQuote';

import type { GalleryCase } from '../galleryTypes';

export const title = 'IssueQuote';

export const cases: GalleryCase[] = [
  {
    title: 'со сноской',
    dark: true,
    node: <IssueQuote quote="Вы ведь обещали вернуться до шторма…" note="бриф: Кира со 2-й ступени на «ты»" />,
  },
  {
    title: 'без сноски',
    dark: true,
    node: <IssueQuote quote="Кто вообще решил, что маяк можно потушить?" />,
  },
  {
    title: 'узкая карточка',
    dark: true,
    node: <IssueQuote quote="Мне не нужен герой, мне нужен маршрут" note="бриф: сцена 3, тон — сухой" width={240} />,
  },
];
