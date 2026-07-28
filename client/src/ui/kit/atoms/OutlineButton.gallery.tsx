import React from 'react';

import OutlineButton from './OutlineButton';

import type { GalleryCase } from '../galleryTypes';

export const title = 'OutlineButton';

export const cases: GalleryCase[] = [
  { title: 'neutral', node: <OutlineButton label="Отменить" onClick={() => {}} /> },
  { title: 'accent', node: <OutlineButton label="Предпросмотр" tone="accent" onClick={() => {}} /> },
  { title: 'danger', node: <OutlineButton label="Удалить" tone="danger" onClick={() => {}} /> },
  { title: 'компактная', node: <OutlineButton label="Готово" size="compact" onClick={() => {}} /> },
  { title: 'disabled', node: <OutlineButton label="Отменить" disabled onClick={() => {}} /> },
  { title: 'без колбэка', node: <OutlineButton label="Только текст" /> },
  { title: 'neutral · на тёмном', dark: true, node: <OutlineButton label="Отменить" onDark onClick={() => {}} /> },
  {
    title: 'accent · на тёмном',
    dark: true,
    node: <OutlineButton label="Предпросмотр" tone="accent" onDark onClick={() => {}} />,
  },
  {
    title: 'danger · на тёмном',
    dark: true,
    node: <OutlineButton label="Удалить" tone="danger" onDark onClick={() => {}} />,
  },
  {
    title: 'disabled · на тёмном',
    dark: true,
    node: <OutlineButton label="Отменить" onDark disabled onClick={() => {}} />,
  },
];
