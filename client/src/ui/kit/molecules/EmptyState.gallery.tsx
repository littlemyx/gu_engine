import React from 'react';

import EmptyState from './EmptyState';

import type { GalleryCase } from '../galleryTypes';

export const title = 'EmptyState';

const HINT = 'хребта ещё нет — его строит генерация плана';

export const cases: GalleryCase[] = [
  {
    title: 'primary, на светлом',
    node: <EmptyState title="Чертёж пуст" hint={HINT} actionLabel="▶ Сгенерировать план" actionKind="primary" />,
  },
  {
    title: 'outline, на светлом',
    node: (
      <EmptyState
        title="Партитура пуста"
        hint="сцены появятся после генерации хребта"
        actionLabel="Заполнить бриф"
        actionKind="outline"
      />
    ),
  },
  {
    title: 'primary, на тёмном',
    node: <EmptyState title="Чертёж пуст" hint={HINT} actionLabel="▶ Сгенерировать план" actionKind="primary" onDark />,
    dark: true,
  },
  {
    title: 'outline, на тёмном',
    node: (
      <EmptyState
        title="Карта мира пуста"
        hint="календарь появится после генерации плана"
        actionLabel="Открыть бриф"
        actionKind="outline"
        onDark
      />
    ),
    dark: true,
  },
];
