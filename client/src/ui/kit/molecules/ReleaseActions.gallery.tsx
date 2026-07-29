import React from 'react';

import ReleaseActions, { type ReleaseAction } from './ReleaseActions';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ReleaseActions';

const ITEMS: ReleaseAction[] = [
  { label: '▶ Сыграть' },
  { label: 'Скачать .gu.json' },
  { label: 'Восстановить как черновик', accent: true },
];

export const cases: GalleryCase[] = [
  { title: 'по умолчанию', node: <ReleaseActions items={ITEMS} onPick={() => {}} /> },
  { title: 'disabled', node: <ReleaseActions items={ITEMS} disabled onPick={() => {}} /> },
  { title: 'без колбэка', node: <ReleaseActions items={ITEMS} /> },
  { title: 'на тёмном', node: <ReleaseActions items={ITEMS} onDark onPick={() => {}} />, dark: true },
];
