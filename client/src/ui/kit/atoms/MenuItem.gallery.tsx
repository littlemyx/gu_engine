import React from 'react';

import MenuItem from './MenuItem';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MenuItem';

export const cases: GalleryCase[] = [
  {
    title: 'обычный',
    dark: true,
    node: <MenuItem label="Сгенерировать сцену" hotkey="⌘G" onDark onClick={() => {}} />,
  },
  { title: '✓ toggle', dark: true, node: <MenuItem label="Показывать сетку" mark="check" onDark onClick={() => {}} /> },
  { title: '• radio', dark: true, node: <MenuItem label="Крупный размер" mark="radio" onDark onClick={() => {}} /> },
  { title: 'disabled', dark: true, node: <MenuItem label="Отменить" hotkey="⌘Z" disabled onDark onClick={() => {}} /> },
  { title: 'hot', dark: true, node: <MenuItem label="Повторить" hot onDark onClick={() => {}} /> },
  {
    title: 'за разделителем',
    dark: true,
    node: <MenuItem label="Удалить проект" separator onDark onClick={() => {}} />,
  },
  {
    title: 'с ценником',
    dark: true,
    node: <MenuItem label="Сгенерировать реплики" price="0.4₽" onDark onClick={() => {}} />,
  },
  { title: 'обычный · на светлом', node: <MenuItem label="Сгенерировать сцену" hotkey="⌘G" onClick={() => {}} /> },
  { title: '✓ toggle · на светлом', node: <MenuItem label="Показывать сетку" mark="check" onClick={() => {}} /> },
  { title: 'disabled · на светлом', node: <MenuItem label="Отменить" disabled onClick={() => {}} /> },
];
