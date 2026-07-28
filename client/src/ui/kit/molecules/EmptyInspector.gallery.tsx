import React from 'react';

import EmptyInspector from './EmptyInspector';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ПУСТОЙ ИНСПЕКТОР';

const LINES = ['Ничего не выбрано.', 'Выберите узел в иерархии или объект на чертеже.'];

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <EmptyInspector lines={LINES} /> },
  { title: 'на тёмном', dark: true, node: <EmptyInspector lines={LINES} onDark /> },
  { title: 'одна строка', node: <EmptyInspector lines={['Пусто.']} /> },
];
