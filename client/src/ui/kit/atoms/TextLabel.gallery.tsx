import React from 'react';

import TextLabel from './TextLabel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TextLabel';

export const cases: GalleryCase[] = [
  { title: 'на светлом', node: <TextLabel text="Метка интерфейса" /> },
  { title: 'bold', node: <TextLabel text="Метка интерфейса" bold /> },
  { title: 'на тёмном', dark: true, node: <TextLabel text="Метка интерфейса" onDark /> },
  { title: 'на тёмном · bold', dark: true, node: <TextLabel text="Метка интерфейса" onDark bold /> },
  { title: 'тон muted', node: <TextLabel text="Приглушённая подпись" tone="muted" /> },
  { title: 'тон accent', node: <TextLabel text="Акцентная подпись" tone="accent" /> },
  { title: 'тон error', node: <TextLabel text="Ошибка" tone="error" /> },
  { title: 'тон warn', node: <TextLabel text="Предупреждение" tone="warn" /> },
  { title: 'тон accent · bold', node: <TextLabel text="Имя трека" tone="accent" bold /> },
  { title: 'тон error · bold на светлом', node: <TextLabel text="Статус: сбой" tone="error" bold /> },
  { title: 'на тёмном · тон muted', dark: true, node: <TextLabel text="Приглушённая подпись" onDark tone="muted" /> },
  { title: 'на тёмном · тон accent', dark: true, node: <TextLabel text="Акцентная подпись" onDark tone="accent" /> },
  { title: 'на тёмном · тон error', dark: true, node: <TextLabel text="Ошибка" onDark tone="error" /> },
  { title: 'на тёмном · тон warn', dark: true, node: <TextLabel text="Предупреждение" onDark tone="warn" /> },
  {
    title: 'на тёмном · тон accent · bold',
    dark: true,
    node: <TextLabel text="Имя трека" onDark tone="accent" bold />,
  },
];
