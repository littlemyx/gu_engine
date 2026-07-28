import React from 'react';

import ZoneSwitcher from './ZoneSwitcher';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ZoneSwitcher';

export const cases: GalleryCase[] = [
  {
    title: 'свёрнут',
    node: <ZoneSwitcher zoneLabel="1 · Структура" open={false} onToggle={() => {}} />,
    dark: true,
  },
  {
    title: 'раскрыт',
    node: <ZoneSwitcher zoneLabel="1 · Структура" open onToggle={() => {}} />,
    dark: true,
  },
  {
    title: 'другой кикер',
    node: <ZoneSwitcher kickerLabel="ЭТАП" zoneLabel="4 · Медиа" open onToggle={() => {}} />,
    dark: true,
  },
  {
    title: 'без колбэка (немая)',
    node: <ZoneSwitcher zoneLabel="1 · Структура" />,
    dark: true,
  },
];
