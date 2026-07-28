import React from 'react';

import Input from './Input';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Input';

export const cases: GalleryCase[] = [
  { title: 'светлый', node: <Input placeholder="поиск: персонаж, мир, аудио…" /> },
  { title: 'тёмный', dark: true, node: <Input placeholder="поиск: персонаж, мир, аудио…" onDark /> },
  { title: 'multiline', node: <Input placeholder="заметка к сцене…" multiline /> },
  { title: 'mono', node: <Input placeholder="seed: 4821" mono /> },
  { title: 'hover', node: <Input placeholder="наведи курсор" value="черновик" /> },
  { title: 'focus', node: <Input placeholder="кликни в поле" value="черновик" /> },
  { title: 'disabled', node: <Input placeholder="недоступно" value="черновик" disabled /> },
  { title: 'error', node: <Input placeholder="обязательное поле" error /> },
  { title: 'error · на тёмном', dark: true, node: <Input placeholder="обязательное поле" error onDark /> },
];
