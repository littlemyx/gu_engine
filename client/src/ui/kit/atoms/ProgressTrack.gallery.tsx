import React from 'react';

import ProgressTrack from './ProgressTrack';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ProgressTrack';

export const cases: GalleryCase[] = [
  {
    title: 'тонкая · loading',
    node: <ProgressTrack value={62} label="генерация" />,
  },
  {
    title: 'тонкая · error',
    node: <ProgressTrack value={38} label="генерация" tone="error" />,
  },
  {
    title: 'тулбарная · loading',
    node: <ProgressTrack value={62} label="рендер" size="toolbar" />,
  },
  {
    title: 'тулбарная · error',
    node: <ProgressTrack value={20} label="рендер" size="toolbar" tone="error" />,
  },
  {
    title: 'с меткой-лимитом',
    node: <ProgressTrack value={62} label="бюджет" limit={80} />,
  },
  {
    title: 'без подписи',
    node: <ProgressTrack value={62} showLabel={false} />,
  },
  {
    title: 'тонкая · loading · на тёмном',
    dark: true,
    node: <ProgressTrack value={62} label="генерация" onDark />,
  },
  {
    title: 'тулбарная · с меткой · на тёмном',
    dark: true,
    node: <ProgressTrack value={62} label="бюджет" size="toolbar" limit={80} onDark />,
  },
  {
    title: 'error · на тёмном',
    dark: true,
    node: <ProgressTrack value={38} label="генерация" tone="error" onDark />,
  },
];
