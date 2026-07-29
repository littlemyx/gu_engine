import React from 'react';

import ToolbarSelect from './ToolbarSelect';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ToolbarSelect';

export const cases: GalleryCase[] = [
  { title: 'обычный', dark: true, node: <ToolbarSelect label="ветка:" value="все" onClick={() => {}} /> },
  {
    title: 'без стрелки',
    dark: true,
    node: <ToolbarSelect label="слой:" value="фон" arrow={false} onClick={() => {}} />,
  },
  {
    title: 'моно',
    dark: true,
    node: <ToolbarSelect label="политика:" value="strict" mono onClick={() => {}} />,
  },
  {
    title: 'изменено',
    dark: true,
    node: <ToolbarSelect label="ветка:" value="эксперимент-3" changed onClick={() => {}} />,
  },
  {
    title: 'отключено',
    dark: true,
    node: <ToolbarSelect label="ветка:" value="все" disabled onClick={() => {}} />,
  },
  { title: 'без подписи', dark: true, node: <ToolbarSelect value="все" onClick={() => {}} /> },
  { title: 'без onClick', dark: true, node: <ToolbarSelect label="ветка:" value="все" /> },
];
